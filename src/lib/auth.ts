import "server-only";
import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { and, asc, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getDb, sessions, users, type Visibility } from "@/db";

const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

const COOKIE = "mt_session";
const SESSION_DAYS = 60;

export type CurrentUser = {
  id: number;
  username: string;
  displayName: string;
  visibility: Visibility;
  hideWatched: boolean;
};

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, 64);
  return `${salt.toString("hex")}:${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [saltHex, keyHex] = stored.split(":");
  if (!saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, "hex");
  const actual = await scryptAsync(password, Buffer.from(saltHex, "hex"), expected.length);
  return timingSafeEqual(actual, expected);
}

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(userId: number) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const db = await getDb();
  await db.insert(sessions).values({ id: hashToken(token), userId, expiresAt });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) {
    const db = await getDb();
    await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
  }
  store.delete(COOKIE);
}

/** The logged-in user, or null for visitors. Deduplicated per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const db = await getDb();
  const [row] = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      visibility: users.visibility,
      hideWatched: users.hideWatched,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.id, hashToken(token)), gt(sessions.expiresAt, new Date())));
  return row ?? null;
});

/** For server actions and owner-only pages. */
export async function requireUser(next?: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  return user;
}

/**
 * The site owner: the first account created. Public pages (library, diary, stats)
 * show this person's data. Built so more accounts + friends can be added later.
 */
export const getOwner = cache(async (): Promise<CurrentUser | null> => {
  const db = await getDb();
  const [row] = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      visibility: users.visibility,
      hideWatched: users.hideWatched,
    })
    .from(users)
    .orderBy(asc(users.id))
    .limit(1);
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
