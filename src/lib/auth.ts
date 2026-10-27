import "server-only";
import { scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { auth, currentUser } from "@clerk/nextjs/server";
import { and, asc, eq, isNotNull, isNull, like } from "drizzle-orm";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getDb, users, type DB, type Visibility } from "@/db";

/**
 * Sign-in is handled by Clerk (passwords, Google, 2FA, password resets). Every Clerk account gets its own
 * user row here, which owns that person's diary, watchlist, ratings and settings.
 */

export type CurrentUser = {
  id: number;
  username: string;
  displayName: string;
  visibility: Visibility;
  hideWatched: boolean;
  /** Pop up new Plex watches to rate. */
  ratePrompt: boolean;
};

const userColumns = {
  id: users.id,
  username: users.username,
  displayName: users.displayName,
  visibility: users.visibility,
  hideWatched: users.hideWatched,
  ratePrompt: users.ratePrompt,
};

export const USERNAME_PATTERN = /^[a-z0-9_]{3,24}$/;

/** "Marcus.Ayers+test" → "marcusayerstest" */
function toHandle(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 24);
}

/** The first free username starting with `handle`: marcus, marcus2, marcus3… */
async function freeUsername(db: DB, handle: string) {
  const taken = new Set((await db.select({ u: users.username }).from(users).where(like(users.username, `${handle}%`))).map((r) => r.u));
  if (!taken.has(handle)) return handle;
  for (let n = 2; ; n++) {
    const candidate = `${handle.slice(0, 24 - String(n).length)}${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/** Creates this site's account for a Clerk sign-in. New accounts start private. */
export async function createUser(db: DB, clerkId: string): Promise<CurrentUser> {
  const profile = await currentUser();
  const email = profile?.primaryEmailAddress?.emailAddress ?? "";
  // "marcus+movies@gmail.com" → "marcus"
  let handle = toHandle(profile?.username || email.split("@")[0].split("+")[0]);
  if (handle.length < 3) handle = `user${handle}`;
  const displayName = (profile?.firstName || profile?.username || handle).slice(0, 60);
  for (let attempt = 0; attempt < 5; attempt++) {
    const username = await freeUsername(db, handle);
    const [row] = await db
      .insert(users)
      .values({ clerkId, username, displayName, visibility: "private" })
      .onConflictDoNothing()
      .returning(userColumns);
    if (row) return row;
    // Either a parallel request already created this account, or someone took the username a moment ago.
    const [existing] = await db.select(userColumns).from(users).where(eq(users.clerkId, clerkId));
    if (existing) return existing;
  }
  throw new Error("Couldn't create your account. Try again.");
}

/** Accounts made before Clerk that nobody has linked yet. Only exists on sites set up before Clerk. */
export const hasUnlinkedLegacyAccount = cache(async () => {
  const db = await getDb();
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(isNull(users.clerkId), isNotNull(users.passwordHash)))
    .limit(1);
  return Boolean(row);
});

/**
 * The signed-in user, or null for visitors. A first sign-in creates the account, unless an account from
 * before Clerk is still waiting to be linked: then /account asks whether to link it or start fresh.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const { userId: clerkId } = await auth();
  if (!clerkId) return null;
  const db = await getDb();
  const [row] = await db.select(userColumns).from(users).where(eq(users.clerkId, clerkId));
  if (row) return row;
  if (await hasUnlinkedLegacyAccount()) return null;
  return createUser(db, clerkId);
});

export type SignInState = "signed-out" | "signed-in" | "needs-link";

export const getSignInState = cache(async (): Promise<SignInState> => {
  const { userId } = await auth();
  if (!userId) return "signed-out";
  return (await getCurrentUser()) ? "signed-in" : "needs-link";
});

/** For server actions and pages that need an account. */
export async function requireUser(next?: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (user) return user;
  const state = await getSignInState();
  if (state === "signed-out") redirect(next ? `/sign-in?redirect_url=${encodeURIComponent(next)}` : "/sign-in");
  redirect("/account");
}

/** The first account on the site. Only it can run the site-wide ratings job by hand. */
export const isSiteAdmin = cache(async (userId: number) => {
  const db = await getDb();
  const [first] = await db.select({ id: users.id }).from(users).orderBy(asc(users.id)).limit(1);
  return first?.id === userId;
});

export type ProfileAccess =
  | { status: "not-found" }
  | { status: "private"; profile: CurrentUser }
  | { status: "ok"; profile: CurrentUser; isOwn: boolean };

/** Whether the current visitor may see someone's public profile (/u/username). */
export const getProfileAccess = cache(async (username: string): Promise<ProfileAccess> => {
  const db = await getDb();
  const [[profile], viewer] = await Promise.all([
    db.select(userColumns).from(users).where(eq(users.username, username.toLowerCase())),
    getCurrentUser(),
  ]);
  if (!profile) return { status: "not-found" };
  const isOwn = viewer?.id === profile.id;
  // "friends" behaves like "private" until a friends system exists.
  if (!isOwn && profile.visibility !== "everyone") return { status: "private", profile };
  return { status: "ok", profile, isOwn };
});

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
