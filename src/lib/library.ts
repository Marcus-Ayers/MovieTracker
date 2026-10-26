import "server-only";
import { and, desc, eq, gt, inArray } from "drizzle-orm";
import { cache } from "react";
import { credits, getDb, people, titles, userTitles, viewings, type Title, type Viewing } from "@/db";
import type { MediaType } from "./format";

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

export async function getViewings(userId: number): Promise<ViewingWithTitle[]> {
  const db = await getDb();
  return db
    .select({ viewing: viewings, title: titles })
    .from(viewings)
    .innerJoin(titles, eq(viewings.titleId, titles.id))
    .where(eq(viewings.userId, userId));
}

/** Everything you've watched, one entry per title. */
export async function getLibrary(userId: number): Promise<LibraryEntry[]> {
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
}

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

export async function getWatchlist(userId: number): Promise<Title[]> {
  const db = await getDb();
  const rows = await db
    .select({ title: titles })
    .from(userTitles)
    .innerJoin(titles, eq(userTitles.titleId, titles.id))
    .where(and(eq(userTitles.userId, userId), eq(userTitles.onWatchlist, true)))
    .orderBy(desc(userTitles.watchlistedAt));
  return rows.map((r) => r.title);
}

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
