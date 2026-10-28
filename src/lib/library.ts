import "server-only";
import { and, desc, eq, gt, inArray, notInArray, type SQL } from "drizzle-orm";
import { cache } from "react";
import { credits, getDb, people, titles, users, userTitles, viewings, type Title, type Viewing } from "@/db";
import type { ViewingDraft } from "@/components/log/log-button";
import type { MediaType } from "./format";

/**
 * Reading someone's diary: every entry (getViewings), one entry per title with the rating math (getLibrary /
 * summarize), one title's state, the watchlist, credits, and what friends or the community thought of a title.
 * Most personal pages are built on these queries, so the big ones are deduplicated per request with React's
 * cache().
 */

export type ViewingWithTitle = { viewing: Viewing; title: Title };

/** Oldest → newest. "Date unknown" entries count as the oldest. */
export function compareViewings(a: Viewing, b: Viewing) {
  const da = a.watchedOn ?? "0000-00-00";
  const db = b.watchedOn ?? "0000-00-00";
  return da === db ? a.createdAt.getTime() - b.createdAt.getTime() : da.localeCompare(db);
}

export type LibraryEntry = {
  title: Title;
  viewings: Viewing[];
  watchCount: number;
  priorWatchCount: number;
  /** Movie: your latest rating. TV: whole-series rating if logged, else the average of your season ratings. */
  rating: number | null;
  seasonRatings: Record<number, number>;
  firstWatched: string | null;
  lastWatched: string | null;
  liked: boolean;
  mainReview: Viewing | null;
};

/**
 * One title's diary entries summed up: watch count, your current rating (TV: whole-series rating, else the average
 * of your season ratings), first and last watch, liked, and the main review.
 */
export function summarize(title: Title, entries: Viewing[], priorWatchCount: number): LibraryEntry {
  const sorted = [...entries].sort(compareViewings);
  const dated = sorted.filter((v) => v.watchedOn);

  let rating: number | null = null;
  const seasonRatings: Record<number, number> = {};
  if (title.mediaType === "tv") {
    let seriesRating: number | null = null;
    for (const v of sorted) {
      if (v.rating === null) continue;
      if (v.seasonNumber === null) seriesRating = v.rating;
      else seasonRatings[v.seasonNumber] = v.rating;
    }
    const seasonValues = Object.entries(seasonRatings)
      .filter(([season]) => season !== "0")
      .map(([, r]) => r);
    rating =
      seriesRating ??
      (seasonValues.length ? Math.round(seasonValues.reduce((a, b) => a + b, 0) / seasonValues.length) : null);
  } else {
    for (const v of sorted) if (v.rating !== null) rating = v.rating;
  }

  const reviews = sorted.filter((v) => v.reviewHtml);
  return {
    title,
    viewings: sorted,
    watchCount: sorted.length + priorWatchCount,
    priorWatchCount,
    rating,
    seasonRatings,
    firstWatched: dated[0]?.watchedOn ?? null,
    lastWatched: dated.at(-1)?.watchedOn ?? null,
    liked: sorted.some((v) => v.liked),
    mainReview: reviews.find((v) => v.isMainReview) ?? reviews.at(-1) ?? null,
  };
}

/**
 * Every diary entry someone has, with its title. Deduplicated per request (React's cache), because a single page
 * often needs it more than once (e.g. the library plus its "Rate N unrated" count). Treat the result as
 * read-only: copy before sorting.
 */
export const getViewings = cache(async (userId: number): Promise<ViewingWithTitle[]> => {
  const db = await getDb();
  return db
    .select({ viewing: viewings, title: titles })
    .from(viewings)
    .innerJoin(titles, eq(viewings.titleId, titles.id))
    .where(eq(viewings.userId, userId));
});

/** Everything someone has watched, one entry per title. Deduplicated per request, like getViewings. */
export const getLibrary = cache(async (userId: number): Promise<LibraryEntry[]> => {
  const db = await getDb();
  const [rows, priorRows] = await Promise.all([
    getViewings(userId),
    db
      .select({ title: titles, prior: userTitles.priorWatchCount })
      .from(userTitles)
      .innerJoin(titles, eq(userTitles.titleId, titles.id))
      .where(and(eq(userTitles.userId, userId), gt(userTitles.priorWatchCount, 0))),
  ]);

  const byTitle = new Map<number, { title: Title; viewings: Viewing[]; prior: number }>();
  for (const { viewing, title } of rows) {
    const group = byTitle.get(title.id) ?? { title, viewings: [], prior: 0 };
    group.viewings.push(viewing);
    byTitle.set(title.id, group);
  }
  for (const { title, prior } of priorRows) {
    const group = byTitle.get(title.id) ?? { title, viewings: [], prior: 0 };
    group.prior = prior;
    byTitle.set(title.id, group);
  }
  return [...byTitle.values()].map((g) => summarize(g.title, g.viewings, g.prior));
});

/** Key for a watched map: "movie-949". */
export const watchedKey = (mediaType: MediaType, tmdbId: number) => `${mediaType}-${tmdbId}`;

/** For poster badges while browsing: "movie-123" → your rating (or null if watched but unrated). */
export async function getWatchedMap(userId: number): Promise<Record<string, number | null>> {
  const library = await getLibrary(userId);
  return Object.fromEntries(library.map((e) => [watchedKey(e.title.mediaType, e.title.tmdbId), e.rating]));
}

/** Your entry for one title. Deduplicated per request (the title page asks for it twice). */
export const getTitleState = cache(async (userId: number, tmdbId: number, mediaType: MediaType) => {
  const db = await getDb();
  const [title] = await db
    .select()
    .from(titles)
    .where(and(eq(titles.tmdbId, tmdbId), eq(titles.mediaType, mediaType)));
  if (!title) return { entry: null, onWatchlist: false, priorWatchCount: 0 };

  const [entries, [state]] = await Promise.all([
    db
      .select()
      .from(viewings)
      .where(and(eq(viewings.userId, userId), eq(viewings.titleId, title.id))),
    db
      .select()
      .from(userTitles)
      .where(and(eq(userTitles.userId, userId), eq(userTitles.titleId, title.id))),
  ]);
  const prior = state?.priorWatchCount ?? 0;
  return {
    entry: entries.length || prior ? summarize(title, entries, prior) : null,
    onWatchlist: state?.onWatchlist ?? false,
    priorWatchCount: prior,
  };
});

export type PublicTake = { username: string; displayName: string; entry: LibraryEntry };

/** Each matching person's entry for one title. */
async function takesFor(tmdbId: number, mediaType: MediaType, who: SQL | undefined, onlyOpinions: boolean, limit: number): Promise<PublicTake[]> {
  const db = await getDb();
  const rows = await db
    .select({ viewing: viewings, title: titles, username: users.username, displayName: users.displayName })
    .from(viewings)
    .innerJoin(titles, eq(titles.id, viewings.titleId))
    .innerJoin(users, eq(users.id, viewings.userId))
    .where(and(eq(titles.tmdbId, tmdbId), eq(titles.mediaType, mediaType), who));
  const byUser = new Map<string, { displayName: string; title: Title; viewings: Viewing[] }>();
  for (const r of rows) {
    const group = byUser.get(r.username) ?? { displayName: r.displayName, title: r.title, viewings: [] };
    group.viewings.push(r.viewing);
    byUser.set(r.username, group);
  }
  return [...byUser.entries()]
    .map(([username, g]) => ({ username, displayName: g.displayName, entry: summarize(g.title, g.viewings, 0) }))
    .filter((t) => !onlyOpinions || t.entry.rating !== null || t.entry.mainReview)
    .sort(
      (a, b) =>
        Number(Boolean(b.entry.mainReview)) - Number(Boolean(a.entry.mainReview)) ||
        (b.entry.lastWatched ?? "").localeCompare(a.entry.lastWatched ?? ""),
    )
    .slice(0, limit);
}

/** Ratings and reviews of one title from public profiles (social features on), reviews first. */
export function getPublicTakes(tmdbId: number, mediaType: MediaType, excludeUserIds: number[], limit = 12) {
  const who = and(eq(users.visibility, "everyone"), eq(users.social, true), excludeUserIds.length ? notInArray(users.id, excludeUserIds) : undefined);
  return takesFor(tmdbId, mediaType, who, true, limit);
}

/** These people's entries for one title (friends on a title page), including ones without a rating. */
export async function getTakesBy(userIds: number[], tmdbId: number, mediaType: MediaType) {
  return userIds.length ? takesFor(tmdbId, mediaType, inArray(users.id, userIds), false, 50) : [];
}

/** Your watchlist with when each title was added, newest first. Deduplicated per request. */
export const getWatchlistEntries = cache(async (userId: number): Promise<{ title: Title; addedAt: Date | null }[]> => {
  const db = await getDb();
  return db
    .select({ title: titles, addedAt: userTitles.watchlistedAt })
    .from(userTitles)
    .innerJoin(titles, eq(userTitles.titleId, titles.id))
    .where(and(eq(userTitles.userId, userId), eq(userTitles.onWatchlist, true)))
    .orderBy(desc(userTitles.watchlistedAt));
});

/** Your watchlist titles, newest first. */
export async function getWatchlist(userId: number): Promise<Title[]> {
  return (await getWatchlistEntries(userId)).map((r) => r.title);
}

/** Directors, writers, creators and/or cast for many titles at once (from the credits saved with each title). */
export async function getCreditsFor(titleIds: number[], roles: ("director" | "writer" | "creator" | "cast")[]) {
  if (!titleIds.length) return [];
  const db = await getDb();
  return db
    .select({
      titleId: credits.titleId,
      role: credits.role,
      order: credits.order,
      personId: people.tmdbId,
      name: people.name,
      profilePath: people.profilePath,
    })
    .from(credits)
    .innerJoin(people, eq(credits.personId, people.tmdbId))
    .where(and(inArray(credits.titleId, titleIds), inArray(credits.role, roles)));
}

/** What the log popup needs to know about your past viewings (for "Rewatch" and "main review" defaults). */
export type LogHistory = {
  /** Any earlier viewing (or a "seen before" count) of this title. */
  hasHistory: boolean;
  /** Seasons already logged (null = whole series). */
  loggedSeasons: (number | null)[];
  hasMainReview: boolean;
};

/**
 * What the log form needs to know about past watches: anything logged before (so it can default to Rewatch), which
 * seasons, and whether there's already a main review.
 */
export function historyFor(entry: LibraryEntry | null): LogHistory {
  return {
    hasHistory: Boolean(entry && entry.watchCount > 0),
    loggedSeasons: entry?.viewings.map((v) => v.seasonNumber) ?? [],
    hasMainReview: Boolean(entry?.viewings.some((v) => v.isMainReview && v.reviewHtml)),
  };
}

/** A diary entry in the shape the log form edits (see ViewingDraft in log-button.tsx). */
export const toViewingDraft = (v: Viewing): ViewingDraft => ({
  id: v.id,
  watchedOn: v.watchedOn,
  seasonNumber: v.seasonNumber,
  rating: v.rating,
  liked: v.liked,
  isRewatch: v.isRewatch,
  reviewHtml: v.reviewHtml,
  isMainReview: v.isMainReview,
  containsSpoilers: v.containsSpoilers,
  watchedWhere: v.watchedWhere,
  format: v.format,
  watchedWith: v.watchedWith,
  tags: v.tags,
});
