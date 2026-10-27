"use server";

import { and, count, eq, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { friendships, getDb, users } from "@/db";
import { requireUser } from "./auth";

export type FriendActionResult = { ok: boolean; error?: string };

// A guard against someone spraying requests at everyone.
const MAX_PENDING_SENT = 100;

async function findPerson(username: string) {
  const db = await getDb();
  const [row] = await db
    .select({ id: users.id, username: users.username, social: users.social, friendRequests: users.friendRequests })
    .from(users)
    .where(eq(users.username, username.trim().toLowerCase().replace(/^@/, "")));
  return row ?? null;
}

const between = (a: number, b: number) =>
  or(and(eq(friendships.requesterId, a), eq(friendships.addresseeId, b)), and(eq(friendships.requesterId, b), eq(friendships.addresseeId, a)));

/** Sends a friend request, or accepts theirs if they already sent you one. */
export async function sendFriendRequest(username: string): Promise<FriendActionResult> {
  const me = await requireUser("/friends");
  if (!me.social) return { ok: false, error: "Turn on social features in Settings first." };
  const them = await findPerson(username);
  if (!them || them.id === me.id || !them.social) return { ok: false, error: "You can't add that person." };

  const db = await getDb();
  const [existing] = await db.select().from(friendships).where(between(me.id, them.id));
  if (existing?.status === "pending" && existing.requesterId === them.id) {
    await db
      .update(friendships)
      .set({ status: "accepted", acceptedAt: new Date() })
      .where(and(eq(friendships.requesterId, them.id), eq(friendships.addresseeId, me.id)));
  } else if (!existing) {
    if (!them.friendRequests) return { ok: false, error: `@${them.username} isn't taking friend requests.` };
    const [{ value: pending }] = await db
      .select({ value: count() })
      .from(friendships)
      .where(and(eq(friendships.requesterId, me.id), eq(friendships.status, "pending")));
    if (pending >= MAX_PENDING_SENT) return { ok: false, error: "You have a lot of requests waiting. Cancel some first." };
    await db.insert(friendships).values({ requesterId: me.id, addresseeId: them.id }).onConflictDoNothing();
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Accepts a request someone sent you. */
export async function acceptFriendRequest(username: string): Promise<FriendActionResult> {
  const me = await requireUser("/friends");
  const them = await findPerson(username);
  if (!them) return { ok: false, error: "That request is gone." };
  const db = await getDb();
  await db
    .update(friendships)
    .set({ status: "accepted", acceptedAt: new Date() })
    .where(and(eq(friendships.requesterId, them.id), eq(friendships.addresseeId, me.id), eq(friendships.status, "pending")));
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Declines their request, cancels yours, or unfriends: whatever is between you is removed. */
export async function removeConnection(username: string): Promise<FriendActionResult> {
  const me = await requireUser("/friends");
  const them = await findPerson(username);
  if (!them) return { ok: true };
  const db = await getDb();
  await db.delete(friendships).where(between(me.id, them.id));
  revalidatePath("/", "layout");
  return { ok: true };
}
