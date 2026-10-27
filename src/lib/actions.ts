"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { and, eq, inArray, isNotNull, isNull, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb, plexConnections, plexItems, userTitles, users, viewings, type DB } from "@/db";
import { createUser, isSiteAdmin, requireUser, USERNAME_PATTERN, verifyLegacyPassword } from "./auth";
import type { MediaType } from "./format";
import { getRateQueue } from "./rate-queue";
import { cleanReview } from "./reviews";
import { ensureTitle } from "./title-cache";

export type ActionState = { ok: boolean; error?: string; savedAt?: number };

/** FormData → plain object, treating empty inputs as missing. */
function fields(formData: FormData) {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && value.trim() !== "") out[key] = value;
  }
  return out;
}

const firstError = (error: z.ZodError) => error.issues[0]?.message ?? "Something looks off. Check the form and try again.";

function refreshEverything() {
  revalidatePath("/", "layout");
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

// Wrong-password attempts per Clerk account when linking (a small brute-force guard).
const linkAttempts = new Map<string, { count: number; first: number }>();
const LINK_WINDOW_MS = 15 * 60 * 1000;
const LINK_MAX_ATTEMPTS = 5;

/**
 * One time: connect your Clerk sign-in to the account you made before Clerk, by confirming the old
 * username + password. The old password is then deleted; Clerk handles sign-in from here on.
 */
export async function linkAccount(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in?redirect_url=/account");

  const now = Date.now();
  const attempts = linkAttempts.get(clerkId);
  if (attempts && now - attempts.first < LINK_WINDOW_MS && attempts.count >= LINK_MAX_ATTEMPTS) {
    return { ok: false, error: "Too many attempts. Wait 15 minutes and try again." };
  }

  const data = fields(formData);
  const db = await getDb();
  const [legacy] = await db
    .select()
    .from(users)
    .where(and(eq(users.username, (data.username ?? "").trim().toLowerCase()), isNull(users.clerkId), isNotNull(users.passwordHash)));
  const ok = legacy?.passwordHash != null && (await verifyLegacyPassword(data.password ?? "", legacy.passwordHash));
  if (!ok) {
    const fresh = !attempts || now - attempts.first >= LINK_WINDOW_MS;
    linkAttempts.set(clerkId, fresh ? { count: 1, first: now } : { count: attempts.count + 1, first: attempts.first });
    return { ok: false, error: "That username and password don't match an account waiting to be linked." };
  }

  const [already] = await db.select({ id: users.id }).from(users).where(eq(users.clerkId, clerkId));
  if (already) return { ok: false, error: "This sign-in already has its own account." };
  await db.update(users).set({ clerkId, passwordHash: null }).where(eq(users.id, legacy.id));
  linkAttempts.delete(clerkId);
  refreshEverything();
  redirect("/");
}

/** On a site with an unlinked pre-Clerk account: skip linking and make a new, empty account instead. */
export async function startFresh() {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in?redirect_url=/account");
  const db = await getDb();
  await createUser(db, clerkId);
  refreshEverything();
  redirect("/");
}

const settingsSchema = z.object({
  displayName: z.string().trim().min(1, "Enter a display name.").max(60),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(USERNAME_PATTERN, "Usernames are 3–24 characters: letters, numbers and underscores."),
  visibility: z.enum(["everyone", "friends", "private"]),
  hideWatched: z.literal("on").optional(),
  ratePrompt: z.literal("on").optional(),
  social: z.literal("on").optional(),
  socialHome: z.literal("on").optional(),
  socialTitles: z.literal("on").optional(),
  friendRequests: z.literal("on").optional(),
});

export async function updateSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser("/settings");
  const parsed = settingsSchema.safeParse(fields(formData));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  // Checkboxes named "services", one per ticked streaming service.
  const services = [...new Set(formData.getAll("services").map(Number))].filter((id) => Number.isInteger(id) && id > 0).slice(0, 100);
  const db = await getDb();
  const [taken] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.username, parsed.data.username), ne(users.id, user.id)));
  if (taken) return { ok: false, error: `@${parsed.data.username} is taken. Try another username.` };
  try {
    await db
      .update(users)
      .set({
        displayName: parsed.data.displayName,
        username: parsed.data.username,
        visibility: parsed.data.visibility,
        hideWatched: parsed.data.hideWatched === "on",
        ratePrompt: parsed.data.ratePrompt === "on",
        streamingServices: services,
        social: parsed.data.social === "on",
        socialHome: parsed.data.socialHome === "on",
        socialTitles: parsed.data.socialTitles === "on",
        friendRequests: parsed.data.friendRequests === "on",
        // Turning the pop-up back on starts fresh instead of popping up everything from while it was off.
        ...(parsed.data.ratePrompt === "on" && !user.ratePrompt ? { ratePromptSeenAt: new Date() } : {}),
      })
      .where(eq(users.id, user.id));
  } catch {
    // Someone claimed the username between the check and the save.
    return { ok: false, error: `@${parsed.data.username} is taken. Try another username.` };
  }
  refreshEverything();
  return { ok: true, savedAt: Date.now() };
}

/**
 * Deletes the account: diary, ratings, reviews, watchlist, Plex connection (all removed with the user row),
 * then the Clerk sign-in itself. Asks for the username as confirmation. Nothing is revalidated here on purpose:
 * re-rendering a page now would see the still-valid session and make a fresh empty account. The browser
 * signs out next.
 */
export async function deleteAccount(confirmation: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser("/settings");
  if (confirmation.trim().toLowerCase() !== user.username) return { ok: false, error: `Type ${user.username} to confirm.` };
  const { userId: clerkId } = await auth();
  const db = await getDb();

  // Plex's item lookup cache is per server; drop it unless someone else uses the same server.
  const [plex] = await db.select({ serverId: plexConnections.serverId }).from(plexConnections).where(eq(plexConnections.userId, user.id));
  if (plex?.serverId) {
    const shared = await db
      .select({ userId: plexConnections.userId })
      .from(plexConnections)
      .where(and(eq(plexConnections.serverId, plex.serverId), ne(plexConnections.userId, user.id)));
    if (!shared.length) await db.delete(plexItems).where(eq(plexItems.serverId, plex.serverId));
  }
  await db.delete(users).where(eq(users.id, user.id));

  if (clerkId) {
    try {
      await (await clerkClient()).users.deleteUser(clerkId);
    } catch {
      return { ok: false, error: "Your data is deleted, but your sign-in couldn't be removed. Sign in again later and repeat this to remove it." };
    }
  }
  return { ok: true };
}

export async function setHideWatched(hide: boolean) {
  const user = await requireUser();
  const db = await getDb();
  await db.update(users).set({ hideWatched: hide }).where(eq(users.id, user.id));
  refreshEverything();
}

// ---------------------------------------------------------------------------
// Diary
// ---------------------------------------------------------------------------

const viewingSchema = z.object({
  tmdbId: z.coerce.number().int().positive(),
  mediaType: z.enum(["movie", "tv"]),
  viewingId: z.coerce.number().int().positive().optional(),
  watchedOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date.")
    .optional(),
  dateUnknown: z.literal("on").optional(),
  season: z.string().optional(),
  rating: z.coerce.number().int().min(1).max(10).optional(),
  liked: z.literal("on").optional(),
  isRewatch: z.literal("on").optional(),
  review: z.string().max(100_000).optional(),
  isMainReview: z.literal("on").optional(),
  containsSpoilers: z.literal("on").optional(),
  watchedWhere: z.string().trim().max(80).optional(),
  format: z.string().trim().max(80).optional(),
  watchedWith: z.string().trim().max(200).optional(),
  tags: z.string().max(500).optional(),
});

async function upsertUserTitle(
  db: DB,
  userId: number,
  titleId: number,
  set: Partial<{ onWatchlist: boolean; watchlistedAt: Date | null }>,
) {
  await db
    .insert(userTitles)
    .values({ userId, titleId, ...set })
    .onConflictDoUpdate({ target: [userTitles.userId, userTitles.titleId], set });
}

export async function saveViewing(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = viewingSchema.safeParse(fields(formData));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const input = parsed.data;

  const dateUnknown = input.dateUnknown === "on";
  if (!dateUnknown && !input.watchedOn) return { ok: false, error: "Pick the date you watched it, or tick “Don't remember”." };

  const db = await getDb();
  let titleId: number;
  try {
    titleId = await ensureTitle(db, input.tmdbId, input.mediaType);
  } catch {
    return { ok: false, error: "Couldn't load this title from TMDB. Try again in a moment." };
  }

  const review = cleanReview(input.review);
  const values = {
    userId: user.id,
    titleId,
    watchedOn: dateUnknown ? null : input.watchedOn!,
    seasonNumber:
      input.mediaType === "tv" && input.season && input.season !== "series" ? Number(input.season) : null,
    rating: input.rating ?? null,
    liked: input.liked === "on",
    isRewatch: input.isRewatch === "on",
    reviewHtml: review,
    isMainReview: Boolean(review) && input.isMainReview === "on",
    containsSpoilers: Boolean(review) && input.containsSpoilers === "on",
    watchedWhere: input.watchedWhere ?? null,
    format: input.format ?? null,
    watchedWith: input.watchedWith ?? null,
    tags: (input.tags ?? "")
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 20),
    updatedAt: new Date(),
  };

  let viewingId: number;
  if (input.viewingId) {
    const [row] = await db
      .update(viewings)
      .set(values)
      .where(and(eq(viewings.id, input.viewingId), eq(viewings.userId, user.id)))
      .returning({ id: viewings.id });
    if (!row) return { ok: false, error: "That diary entry no longer exists." };
    viewingId = row.id;
  } else {
    const [row] = await db.insert(viewings).values(values).returning({ id: viewings.id });
    viewingId = row.id;
    // Like Letterboxd: logging something takes it off your watchlist.
    await upsertUserTitle(db, user.id, titleId, { onWatchlist: false });
  }

  if (values.isMainReview) {
    await db
      .update(viewings)
      .set({ isMainReview: false })
      .where(and(eq(viewings.userId, user.id), eq(viewings.titleId, titleId), ne(viewings.id, viewingId)));
  }

  refreshEverything();
  return { ok: true, savedAt: Date.now() };
}

export async function deleteViewing(viewingId: number) {
  const user = await requireUser();
  const db = await getDb();
  await db.delete(viewings).where(and(eq(viewings.id, viewingId), eq(viewings.userId, user.id)));
  refreshEverything();
}

export async function setMainReview(viewingId: number) {
  const user = await requireUser();
  const db = await getDb();
  const [target] = await db
    .select({ titleId: viewings.titleId })
    .from(viewings)
    .where(and(eq(viewings.id, viewingId), eq(viewings.userId, user.id)));
  if (!target) return;
  await db
    .update(viewings)
    .set({ isMainReview: sql`${viewings.id} = ${viewingId}` })
    .where(and(eq(viewings.userId, user.id), eq(viewings.titleId, target.titleId)));
  refreshEverything();
}

export async function adjustPriorWatchCount(tmdbId: number, mediaType: MediaType, delta: number) {
  const user = await requireUser();
  const db = await getDb();
  const titleId = await ensureTitle(db, tmdbId, mediaType);
  await db
    .insert(userTitles)
    .values({ userId: user.id, titleId, priorWatchCount: Math.max(delta, 0) })
    .onConflictDoUpdate({
      target: [userTitles.userId, userTitles.titleId],
      set: { priorWatchCount: sql`greatest(${userTitles.priorWatchCount} + ${delta}, 0)` },
    });
  refreshEverything();
}

/** Explicit add/remove (used by poster hover buttons, which already know the current state). */
export async function setWatchlist(tmdbId: number, mediaType: MediaType, on: boolean) {
  const user = await requireUser();
  const db = await getDb();
  const titleId = await ensureTitle(db, tmdbId, mediaType);
  await upsertUserTitle(db, user.id, titleId, { onWatchlist: on, watchlistedAt: on ? new Date() : null });
  refreshEverything();
}

export async function toggleWatchlist(tmdbId: number, mediaType: MediaType) {
  const user = await requireUser();
  const db = await getDb();
  const titleId = await ensureTitle(db, tmdbId, mediaType);
  const [current] = await db
    .select({ onWatchlist: userTitles.onWatchlist })
    .from(userTitles)
    .where(and(eq(userTitles.userId, user.id), eq(userTitles.titleId, titleId)));
  const next = !current?.onWatchlist;
  await upsertUserTitle(db, user.id, titleId, { onWatchlist: next, watchlistedAt: next ? new Date() : null });
  refreshEverything();
}

// ---------------------------------------------------------------------------
// Rating queue (/rate and the new-Plex-watches pop-up)
// ---------------------------------------------------------------------------

// No revalidatePath here: the queue moves on by itself, and every personal page is rendered fresh per request.

const ratingSchema = z.number().int().min(1).max(10).nullable();
const idsSchema = z.array(z.number().int().positive()).min(1).max(500);

/** The next batch of the queue, once you've worked through the one the page loaded with. */
export async function loadRateQueue() {
  const user = await requireUser("/rate");
  return getRateQueue(user.id);
}

/** Rate (or, with null, undo the rating of) one diary entry from the queue. */
export async function rateFromQueue(viewingId: number, rating: number | null) {
  const user = await requireUser("/rate");
  const db = await getDb();
  await db
    .update(viewings)
    .set({ rating: ratingSchema.parse(rating), updatedAt: new Date() })
    .where(and(eq(viewings.id, z.number().int().positive().parse(viewingId)), eq(viewings.userId, user.id)));
}

/** "Don't ask about this": keeps a movie or season out of the queue until you log it again. */
export async function setSkipRating(viewingIds: number[], skip: boolean) {
  const user = await requireUser("/rate");
  const db = await getDb();
  await db
    .update(viewings)
    .set({ skipRating: skip })
    .where(and(inArray(viewings.id, idsSchema.parse(viewingIds)), eq(viewings.userId, user.id)));
}

/** Closes the new-Plex-watches pop-up: anything synced up to `checkedAt` won't pop up again. */
export async function dismissRatePrompt(checkedAt: string) {
  const user = await requireUser();
  const when = new Date(checkedAt);
  const db = await getDb();
  await db
    .update(users)
    .set({ ratePromptSeenAt: Number.isNaN(when.getTime()) || when > new Date() ? new Date() : when })
    .where(eq(users.id, user.id));
}

// ---------------------------------------------------------------------------
// Ratings data
// ---------------------------------------------------------------------------

/** "Update now" in Settings: runs the nightly job immediately. */
export async function runRatingsUpdate(): Promise<{ message: string }> {
  const user = await requireUser("/settings");
  if (!(await isSiteAdmin(user.id))) return { message: "Only the site admin can run this. It updates by itself every night." };
  const { runDailyJobs } = await import("./jobs");
  const result = await runDailyJobs();
  refreshEverything();
  const parts: string[] = [];
  if (result.imdb && !result.imdb.skipped) parts.push(`IMDb ratings loaded for ${result.imdb.stored.toLocaleString()} titles`);
  parts.push(
    `${result.ratings.fetched.toLocaleString()} Rotten Tomatoes scores fetched` + (result.ratings.reason ? ` (${result.ratings.reason})` : ""),
  );
  if (result.ratings.remaining) parts.push(`${result.ratings.remaining.toLocaleString()} more queued for tomorrow`);
  if (result.errors.length) parts.push(`Problems: ${result.errors.join("; ")}`);
  return { message: `${parts.join(". ")}.` };
}
