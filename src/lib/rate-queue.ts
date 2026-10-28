import "server-only";
import type { ViewingDraft } from "@/components/log/log-button";
import type { Title, Viewing } from "@/db";
import { seasonLabel, type MediaType } from "./format";
import { compareViewings, getCreditsFor, getViewings, toViewingDraft, type LogHistory, type ViewingWithTitle } from "./library";

/** One thing to rate: a movie, or one season of a show. */
export type RateItem = {
  key: string;
  /** The rating goes on the most recent diary entry, so rating never adds a new entry. */
  viewingId: number;
  /** Every entry in the group, for "Don't ask about this". */
  viewingIds: number[];
  tmdbId: number;
  mediaType: MediaType;
  seasonNumber: number | null;
  title: string;
  /** "Season 2" for TV. */
  seasonName: string | null;
  year: number | null;
  posterPath: string | null;
  backdropPath: string | null;
  overview: string | null;
  runtime: number | null;
  genres: string[];
  /** TMDB's average; IMDb, Rotten Tomatoes and Metacritic load with the plot. */
  tmdbScore: number | null;
  imdbId: string | null;
  makers: { label: string; names: string[] } | null;
  cast: string[];
  watchCount: number;
  lastWatched: string | null;
  watchedWhere: string | null;
  /** For "Write a review", which edits the latest entry in the full log dialog. */
  draft: ViewingDraft;
  seasons: { number: number; name: string }[];
  history: LogHistory;
};


type Group = { title: Title; seasonNumber: number | null; viewings: Viewing[]; latest: Viewing };

/**
 * Movies (and TV seasons) you've logged but never rated. A show you rated as a whole doesn't ask about its
 * seasons, and "Don't ask about this" hides a group until you log it again.
 */
function unratedGroups(rows: ViewingWithTitle[]): Group[] {
  const groups = new Map<string, Omit<Group, "latest">>();
  const showsRated = new Set<number>();
  for (const { viewing: v, title: t } of rows) {
    if (t.mediaType === "tv" && v.seasonNumber === null && v.rating !== null) showsRated.add(t.id);
    const season = t.mediaType === "tv" ? v.seasonNumber : null;
    const key = `${t.id}:${season ?? "all"}`;
    const group = groups.get(key) ?? { title: t, seasonNumber: season, viewings: [] };
    group.viewings.push(v);
    groups.set(key, group);
  }
  return [...groups.values()]
    .filter((g) => !showsRated.has(g.title.id) && g.viewings.every((v) => v.rating === null) && g.viewings.some((v) => !v.skipRating))
    .map((g) => ({ ...g, latest: [...g.viewings].sort(compareViewings).at(-1)! }))
    // Most recently watched first; undated ones last.
    .sort((a, b) => compareViewings(b.latest, a.latest));
}

async function toItems(groups: Group[]): Promise<RateItem[]> {
  const credits = await getCreditsFor([...new Set(groups.map((g) => g.title.id))], ["director", "creator", "cast"]);
  credits.sort((a, b) => a.order - b.order);
  const namesFor = (titleId: number, role: "director" | "creator" | "cast", max: number) =>
    [...new Set(credits.filter((c) => c.titleId === titleId && c.role === role).map((c) => c.name))].slice(0, max);

  return groups.map(({ title: t, seasonNumber, viewings, latest }) => {
    const makers = t.mediaType === "movie" ? namesFor(t.id, "director", 2) : namesFor(t.id, "creator", 2);
    const season = seasonNumber === null ? null : t.seasons.find((s) => s.number === seasonNumber);
    return {
      key: `${t.mediaType}-${t.tmdbId}-${seasonNumber ?? "all"}`,
      viewingId: latest.id,
      viewingIds: viewings.map((v) => v.id),
      tmdbId: t.tmdbId,
      mediaType: t.mediaType,
      seasonNumber,
      title: t.title,
      seasonName: t.mediaType === "tv" ? (season?.name ?? seasonLabel(seasonNumber)) : null,
      year: t.year,
      posterPath: season?.posterPath ?? t.posterPath,
      backdropPath: t.backdropPath,
      overview: t.overview,
      runtime: t.runtime,
      genres: t.genres.map((g) => g.name),
      tmdbScore: t.voteAverage || null,
      imdbId: t.imdbId,
      makers: makers.length ? { label: t.mediaType === "movie" ? "Directed by" : "Created by", names: makers } : null,
      cast: namesFor(t.id, "cast", 4),
      watchCount: viewings.length,
      lastWatched: latest.watchedOn,
      watchedWhere: latest.watchedWhere,
      draft: toViewingDraft(latest),
      seasons: t.seasons.map((s) => ({ number: s.number, name: s.name })),
      history: {
        hasHistory: true,
        loggedSeasons: viewings.map((v) => v.seasonNumber),
        hasMainReview: viewings.some((v) => v.isMainReview && v.reviewHtml),
      },
    };
  });
}

/** The rating queue: everything unrated, most recent first. */
export async function getRateQueue(userId: number, limit = 60) {
  const groups = unratedGroups(await getViewings(userId));
  return { total: groups.length, items: await toItems(groups.slice(0, limit)) };
}

const isPlex = (v: Viewing) => v.importKey?.startsWith("plex:") ?? false;

/**
 * Unrated Plex watches that arrived since you last saw the pop-up. Only recent watches count, so connecting
 * Plex and pulling in years of history doesn't pop up hundreds of old movies.
 */
export async function getNewPlexWatches(userId: number, since: Date, limit = 10) {
  const recentFrom = new Date(since.getTime() - 3 * 86_400_000).toISOString().slice(0, 10);
  const groups = unratedGroups(await getViewings(userId)).filter((g) =>
    g.viewings.some((v) => isPlex(v) && !v.skipRating && v.createdAt > since && v.watchedOn !== null && v.watchedOn >= recentFrom),
  );
  return { total: groups.length, items: await toItems(groups.slice(0, limit)) };
}
