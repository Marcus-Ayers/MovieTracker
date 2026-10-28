import "server-only";
import { and, asc, count, desc, eq, inArray } from "drizzle-orm";
import { getDb, listItems, lists, titles, users, type List, type Title } from "@/db";
import type { CuratedList } from "./curated";
import type { MediaType } from "./format";
import { getSavedImdbScores } from "./ratings";
import { ensureTitle } from "./title-cache";

/** One title on a list, flattened for the client. */
export type ListItemView = {
  titleId: number;
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  year: number | null;
  posterPath: string | null;
  /** Tier lists: which tier; null = not placed yet. */
  tier: string | null;
  /** Shown under the poster, e.g. "IMDb 8.4" on the internet's tier lists. */
  caption?: string;
};

/** A title as a list item for the client (tier and caption optional). */
export const toItemView = (t: Title, tier: string | null = null, caption?: string): ListItemView => ({
  titleId: t.id,
  tmdbId: t.tmdbId,
  mediaType: t.mediaType,
  title: t.title,
  year: t.year,
  posterPath: t.posterPath,
  tier,
  caption,
});

export type ListSummary = {
  id: number;
  name: string;
  kind: List["kind"];
  count: number;
  posters: (string | null)[];
  href: string;
};

/** Someone's lists, most recently changed first, with the first few posters for the card. */
export async function getListSummaries(userId: number): Promise<ListSummary[]> {
  const db = await getDb();
  const rows = await db.select().from(lists).where(eq(lists.userId, userId)).orderBy(desc(lists.updatedAt));
  if (!rows.length) return [];
  const ids = rows.map((l) => l.id);
  const [counts, firsts] = await Promise.all([
    db.select({ listId: listItems.listId, n: count() }).from(listItems).where(inArray(listItems.listId, ids)).groupBy(listItems.listId),
    db
      .select({ listId: listItems.listId, posterPath: titles.posterPath })
      .from(listItems)
      .innerJoin(titles, eq(titles.id, listItems.titleId))
      .where(inArray(listItems.listId, ids))
      .orderBy(asc(listItems.position)),
  ]);
  return rows.map((l) => ({
    id: l.id,
    name: l.name,
    kind: l.kind,
    count: counts.find((c) => c.listId === l.id)?.n ?? 0,
    posters: firsts.filter((f) => f.listId === l.id).slice(0, 4).map((f) => f.posterPath),
    href: `/lists/${l.id}`,
  }));
}

/** A list, its owner, and its titles in order (tier lists: by position within each tier). */
export async function getList(listId: number) {
  const db = await getDb();
  const [row] = await db
    .select({ list: lists, owner: { id: users.id, username: users.username, displayName: users.displayName } })
    .from(lists)
    .innerJoin(users, eq(users.id, lists.userId))
    .where(eq(lists.id, listId));
  if (!row) return null;
  const items = await db
    .select({ title: titles, tier: listItems.tier })
    .from(listItems)
    .innerJoin(titles, eq(titles.id, listItems.titleId))
    .where(eq(listItems.listId, listId))
    .orderBy(asc(listItems.position));
  return { ...row, items: items.map((i) => toItemView(i.title, i.tier)) };
}

/** Your lists, and whether this title is on each (for "Add to list" on title pages). */
export async function getListsWithTitle(userId: number, tmdbId: number, mediaType: MediaType) {
  const db = await getDb();
  const [mine, [title]] = await Promise.all([
    db.select({ id: lists.id, name: lists.name, kind: lists.kind }).from(lists).where(eq(lists.userId, userId)).orderBy(desc(lists.updatedAt)),
    db.select({ id: titles.id }).from(titles).where(and(eq(titles.tmdbId, tmdbId), eq(titles.mediaType, mediaType))),
  ]);
  const on = title && mine.length
    ? new Set((await db.select({ listId: listItems.listId }).from(listItems).where(and(eq(listItems.titleId, title.id), inArray(listItems.listId, mine.map((l) => l.id))))).map((r) => r.listId))
    : new Set<number>();
  return mine.map((l) => ({ ...l, has: on.has(l.id) }));
}

// ---------------------------------------------------------------------------
// Featured lists (src/lib/curated.ts)
// ---------------------------------------------------------------------------

/** The featured list's titles in order, fetching any this site hasn't seen yet from TMDB (a few at a time). */
export async function loadCuratedTitles(list: CuratedList): Promise<Title[]> {
  const db = await getDb();
  const ids = list.items.map(([id]) => id);
  const read = async () =>
    new Map((await db.select().from(titles).where(and(eq(titles.mediaType, "movie"), inArray(titles.tmdbId, ids)))).map((t) => [t.tmdbId, t]));
  let have = await read();
  const missing = ids.filter((id) => !have.has(id));
  if (missing.length) {
    for (let i = 0; i < missing.length; i += 6) {
      await Promise.all(missing.slice(i, i + 6).map((id) => ensureTitle(db, id, "movie").catch(() => null)));
    }
    have = await read();
  }
  return ids.map((id) => have.get(id)).filter((t): t is Title => Boolean(t));
}

/** Posters for the featured-list cards: the first four titles of each (fetched from TMDB the first time). */
export async function getCuratedPosters(all: CuratedList[]): Promise<Map<string, (string | null)[]>> {
  const db = await getDb();
  const ids = [...new Set(all.flatMap((l) => l.items.slice(0, 4).map(([id]) => id)))];
  const read = async () =>
    new Map(
      (await db.select({ tmdbId: titles.tmdbId, posterPath: titles.posterPath }).from(titles).where(and(eq(titles.mediaType, "movie"), inArray(titles.tmdbId, ids)))).map(
        (t) => [t.tmdbId, t.posterPath],
      ),
    );
  let posters = await read();
  const missing = ids.filter((id) => !posters.has(id));
  if (missing.length) {
    for (let i = 0; i < missing.length; i += 6) await Promise.all(missing.slice(i, i + 6).map((id) => ensureTitle(db, id, "movie").catch(() => null)));
    posters = await read();
  }
  return new Map(all.map((l) => [l.slug, l.items.slice(0, 4).map(([id]) => posters.get(id) ?? null)]));
}

// How much of the list lands in each tier, best first: S is the top 15%, A the next 25%, and so on.
const TIER_SHARES: [string, number][] = [
  ["s", 0.15],
  ["a", 0.4],
  ["b", 0.65],
  ["c", 0.85],
  ["d", 1],
];

/**
 * "Ranked by the internet": tiers from IMDb ratings (TMDB's where IMDb has none), relative to the rest of the
 * list. Anything under 6/10 goes to F regardless. Titles without any rating yet stay unplaced.
 */
export async function internetTiers(list: Title[]): Promise<ListItemView[]> {
  const imdb = await getSavedImdbScores(list.map((t) => t.imdbId).filter((id): id is string => Boolean(id)));
  const scored = list
    .map((t) => {
      const fromImdb = t.imdbId ? imdb.get(t.imdbId) : undefined;
      const score = fromImdb ?? (t.voteAverage || null);
      return { t, score, caption: fromImdb ? `IMDb ${fromImdb.toFixed(1)}` : score ? `TMDB ${score.toFixed(1)}` : undefined };
    })
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  const rated = scored.filter((s) => s.score !== null).length;
  return scored.map((s, i) => {
    if (s.score === null) return toItemView(s.t, null);
    const tier = s.score < 6 ? "f" : TIER_SHARES.find(([, share]) => i < Math.round(share * rated))?.[0] ?? "d";
    return toItemView(s.t, tier, s.caption);
  });
}
