"use server";

import { and, count, eq, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb, userTitles, users, viewings, type DB } from "@/db";
import { createSession, destroySession, hashPassword, requireUser, verifyPassword } from "./auth";
import type { MediaType } from "./format";
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

const setupSchema = z.object({
  displayName: z.string().trim().min(1, "Enter a display name.").max(60),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{3,24}$/, "Username: 3–24 letters, numbers, or underscores."),
  password: z.string().min(8, "Password must be at least 8 characters.").max(200),
});

export async function setupAccount(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = setupSchema.safeParse(fields(formData));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const db = await getDb();
  const [{ value: existing }] = await db.select({ value: count() }).from(users);
  if (existing > 0) return { ok: false, error: "An account already exists. Log in instead." };

  const [user] = await db
    .insert(users)
    .values({
      displayName: parsed.data.displayName,
      username: parsed.data.username,
      passwordHash: await hashPassword(parsed.data.password),
    })
    .returning({ id: users.id });
  await createSession(user.id);
  redirect("/");
}

export async function login(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const data = fields(formData);
  const username = data.username?.trim().toLowerCase() ?? "";
  const db = await getDb();
  const [user] = await db.select().from(users).where(eq(users.username, username));
  if (!user || !(await verifyPassword(data.password ?? "", user.passwordHash))) {
    return { ok: false, error: "Wrong username or password." };
  }
  await createSession(user.id);
  const next = data.next;
  redirect(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function logout() {
  await destroySession();
  redirect("/");
}

const settingsSchema = z.object({
  displayName: z.string().trim().min(1, "Enter a display name.").max(60),
  visibility: z.enum(["everyone", "friends", "private"]),
  hideWatched: z.literal("on").optional(),
});

export async function updateSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser("/settings");
  const parsed = settingsSchema.safeParse(fields(formData));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const db = await getDb();
  await db
    .update(users)
    .set({
      displayName: parsed.data.displayName,
      visibility: parsed.data.visibility,
      hideWatched: parsed.data.hideWatched === "on",
    })
    .where(eq(users.id, user.id));
  refreshEverything();
  return { ok: true, savedAt: Date.now() };
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
