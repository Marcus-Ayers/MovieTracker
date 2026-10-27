import "server-only";
import { scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { auth, currentUser } from "@clerk/nextjs/server";
import { asc, count, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getDb, users, type DB, type Visibility } from "@/db";

/**
 * Sign-in is handled by Clerk (passwords, Google, 2FA, password resets). This file maps the signed-in
 * Clerk account to this site's own user row, which owns the diary, watchlist and settings.
 */

export type CurrentUser = {
  id: number;
  username: string;
  displayName: string;
  visibility: Visibility;
  hideWatched: boolean;
};

const userColumns = {
  id: users.id,
  username: users.username,
  displayName: users.displayName,
  visibility: users.visibility,
  hideWatched: users.hideWatched,
};

/** On a brand-new site, the first person to sign in becomes the owner. */
async function createOwner(db: DB, clerkId: string): Promise<CurrentUser | null> {
  const profile = await currentUser();
  const email = profile?.primaryEmailAddress?.emailAddress ?? "";
  const handle = (profile?.username || email.split("@")[0] || "owner").toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 24) || "owner";
  try {
    const [row] = await db
      .insert(users)
      .values({ clerkId, username: handle, displayName: profile?.firstName || profile?.username || handle })
      .returning(userColumns);
    return row;
  } catch {
    // Two first requests raced; the other one created it.
    const [row] = await db.select(userColumns).from(users).where(eq(users.clerkId, clerkId));
    return row ?? null;
  }
}

/** The signed-in user, or null for visitors. Deduplicated per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const { userId: clerkId } = await auth();
  if (!clerkId) return null;
  const db = await getDb();
  const [row] = await db.select(userColumns).from(users).where(eq(users.clerkId, clerkId));
  if (row) return row;
  const [{ value }] = await db.select({ value: count() }).from(users);
  return value === 0 ? createOwner(db, clerkId) : null;
});

export type SignInState = "signed-out" | "linked" | "needs-link" | "not-owner";

/**
 * Where the visitor stands:
 * - needs-link: signed in with Clerk, and this site has an account from before Clerk that isn't linked yet
 * - not-owner: signed in with Clerk, but the owner's account is already linked to someone else
 */
export const getSignInState = cache(async (): Promise<SignInState> => {
  const { userId } = await auth();
  if (!userId) return "signed-out";
  if (await getCurrentUser()) return "linked";
  const db = await getDb();
  const [owner] = await db.select({ clerkId: users.clerkId }).from(users).orderBy(asc(users.id)).limit(1);
  return owner && !owner.clerkId ? "needs-link" : "not-owner";
});

/** For server actions and owner-only pages. */
export async function requireUser(next?: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (user) return user;
  const state = await getSignInState();
  if (state === "signed-out") redirect(next ? `/sign-in?redirect_url=${encodeURIComponent(next)}` : "/sign-in");
  redirect("/account");
}

/**
 * The site owner: the first account created. Public pages (library, diary, stats)
 * show this person's data. Built so more accounts + friends can be added later.
 */
export const getOwner = cache(async (): Promise<CurrentUser | null> => {
  const db = await getDb();
  const [row] = await db.select(userColumns).from(users).orderBy(asc(users.id)).limit(1);
  return row ?? null;
});

export type ProfileAccess =
  | { status: "no-owner" }
  | { status: "private"; owner: CurrentUser }
  | { status: "ok"; owner: CurrentUser; viewer: CurrentUser | null; isOwner: boolean };

/** Decides whether the current visitor may see the owner's diary, reviews, and stats. */
export async function getProfileAccess(): Promise<ProfileAccess> {
  const [owner, viewer] = await Promise.all([getOwner(), getCurrentUser()]);
  if (!owner) return { status: "no-owner" };
  const isOwner = viewer?.id === owner.id;
  // "friends" behaves like "private" until a friends system exists.
  if (!isOwner && owner.visibility !== "everyone") return { status: "private", owner };
  return { status: "ok", owner, viewer, isOwner };
}

// ---------------------------------------------------------------------------
// Linking an account from before Clerk (one time)
// ---------------------------------------------------------------------------

const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

/** Checks a password against the hash stored by the old (pre-Clerk) login. */
export async function verifyLegacyPassword(password: string, stored: string) {
  const [saltHex, keyHex] = stored.split(":");
  if (!saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, "hex");
  const actual = await scryptAsync(password, Buffer.from(saltHex, "hex"), expected.length);
  return timingSafeEqual(actual, expected);
}
