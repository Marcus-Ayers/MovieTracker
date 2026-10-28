import "server-only";
import { and, desc, eq, ilike, inArray, isNotNull, ne, or } from "drizzle-orm";
import { cache } from "react";
import { friendships, getDb, titles, users, viewings, type Title, type Viewing } from "@/db";

/**
 * Friends are mutual: a request becomes a friendship when the other person accepts.
 *
 * Who shows up where:
 * - Someone with social features off is left out of everyone's social views (search, requests, feeds,
 *   friends' ratings) until they turn them back on. Their friendships are kept.
 * - A friend's diary only appears in your feeds if their profile isn't "Only me".
 */

export type Person = { id: number; username: string; displayName: string };
export type Relation = "none" | "friends" | "outgoing" | "incoming";

const personColumns = { id: users.id, username: users.username, displayName: users.displayName };

/** Everyone you're connected to, by status. Deduplicated per request. */
export const getConnections = cache(async (userId: number) => {
  const db = await getDb();
  const rows = await db
    .select()
    .from(friendships)
    .where(or(eq(friendships.requesterId, userId), eq(friendships.addresseeId, userId)));
  const friends: number[] = [];
  const incoming: { id: number; at: Date }[] = [];
  const outgoing: { id: number; at: Date }[] = [];
  for (const r of rows) {
    const other = r.requesterId === userId ? r.addresseeId : r.requesterId;
    if (r.status === "accepted") friends.push(other);
    else if (r.addresseeId === userId) incoming.push({ id: other, at: r.createdAt });
    else outgoing.push({ id: other, at: r.createdAt });
  }
  return { friends, incoming, outgoing };
});

/** Your relationship to someone: friends, a request either way, or none. */
export async function relationBetween(userId: number, otherId: number): Promise<Relation> {
  const c = await getConnections(userId);
  if (c.friends.includes(otherId)) return "friends";
  if (c.incoming.some((r) => r.id === otherId)) return "incoming";
  if (c.outgoing.some((r) => r.id === otherId)) return "outgoing";
  return "none";
}

/** Of these people, the ones with social features on. (Ids come in as "1,2,3" so the per-request cache can match them.) */
const getActivePeople = cache(async (ids: string) => {
  const list = ids ? ids.split(",").map(Number) : [];
  if (!list.length) return new Map<number, Person & { visibility: string }>();
  const db = await getDb();
  const rows = await db
    .select({ ...personColumns, visibility: users.visibility })
    .from(users)
    .where(and(inArray(users.id, list), eq(users.social, true)));
  return new Map(rows.map((r) => [r.id, r]));
});

/** Friends whose diaries appear in your feeds and on title pages. */
export const getVisibleFriendIds = cache(async (userId: number) => {
  const { friends } = await getConnections(userId);
  const people = await getActivePeople(friends.join(","));
  return friends.filter((id) => people.get(id) && people.get(id)!.visibility !== "private");
});

/** Your friends and requests, for the Friends page. */
export async function getFriendsOverview(userId: number) {
  const c = await getConnections(userId);
  const people = await getActivePeople([...c.friends, ...c.incoming.map((r) => r.id), ...c.outgoing.map((r) => r.id)].join(","));
  const pick = (id: number) => people.get(id);
  const byName = (a: Person, b: Person) => a.displayName.localeCompare(b.displayName);
  return {
    friends: c.friends.map(pick).filter((p): p is NonNullable<typeof p> => Boolean(p)).sort(byName),
    incoming: c.incoming.map((r) => pick(r.id)).filter((p): p is NonNullable<typeof p> => Boolean(p)),
    outgoing: c.outgoing.map((r) => pick(r.id)).filter((p): p is NonNullable<typeof p> => Boolean(p)),
  };
}

/** Friend requests waiting for you (for the badge in the header). */
export async function countIncomingRequests(userId: number) {
  const { incoming } = await getConnections(userId);
  if (!incoming.length) return 0;
  return (await getActivePeople(incoming.map((r) => r.id).join(","))).size;
}

export type FriendActivity = { person: Person; viewing: Viewing; title: Title };

/** What friends watched recently, newest first. Undated entries (old imports) are left out. */
export async function getFriendActivity(userId: number, limit = 40): Promise<FriendActivity[]> {
  const ids = await getVisibleFriendIds(userId);
  if (!ids.length) return [];
  const db = await getDb();
  return db
    .select({ person: personColumns, viewing: viewings, title: titles })
    .from(viewings)
    .innerJoin(titles, eq(titles.id, viewings.titleId))
    .innerJoin(users, eq(users.id, viewings.userId))
    .where(and(inArray(viewings.userId, ids), isNotNull(viewings.watchedOn)))
    .orderBy(desc(viewings.watchedOn), desc(viewings.createdAt))
    .limit(limit);
}

/** People you could add: social features on and accepting requests. Matches username or name. */
export async function searchPeople(userId: number, query: string): Promise<Person[]> {
  const term = query.trim().replace(/^@/, "").replace(/[%_\\]/g, "");
  if (term.length < 2) return [];
  const db = await getDb();
  return db
    .select(personColumns)
    .from(users)
    .where(
      and(
        ne(users.id, userId),
        eq(users.social, true),
        eq(users.friendRequests, true),
        or(ilike(users.username, `${term.toLowerCase()}%`), ilike(users.displayName, `%${term}%`)),
      ),
    )
    .orderBy(users.username)
    .limit(20);
}
