import "server-only";
import { and, eq, gt } from "drizzle-orm";
import { getDb, userTitles, type Title, type Viewing } from "@/db";
import { compareViewings, getCreditsFor, getViewings, type ViewingWithTitle } from "./library";
import { computeStreaks, countBy } from "./stats";

/**
 * Year in review, built from dated diary entries. Undated entries (old imports) can't be placed in a year, so
 * they're left out.
 */

export type RecapFilm = { title: Title; rating: number | null; watches: number; liked: boolean; lastWatched: string };
export type RecapPerson = { id: number; name: string; profilePath: string | null; count: number; avg: number | null; titles: Title[] };
export type RecapMoment = { title: Title; date: string };

export type Recap = {
  year: number;
  films: number;
  watches: number;
  hours: number;
  rewatches: number;
  newToYou: number;
  avgRating: number | null;
  rated: number;
  topFilms: RecapFilm[];
  director: RecapPerson | null;
  actor: RecapPerson | null;
  /** Movie watches per month, January first. */
  months: number[];
  busiestMonth: { month: number; count: number; titles: Title[] } | null;
  busiestDay: { date: string; count: number; titles: Title[] } | null;
  /** Watches per weekday, Sunday first. */
  weekdays: number[];
  longestStreak: number;
  first: RecapMoment | null;
  last: RecapMoment | null;
  genres: [string, number][];
  decades: [number, number][];
  oldest: Title | null;
  places: [string, number][];
  mostRewatched: { title: Title; count: number } | null;
  lovedMore: { title: Title; rating: number; crowd: number } | null;
  hotTake: { title: Title; rating: number; crowd: number } | null;
  tv: { seasons: number; shows: number; hours: number; top: { title: Title; rating: number | null; seasons: number }[] };
  previous: { year: number; films: number; hours: number } | null;
};

export type RecapYear = { year: number; films: number; seasons: number; hours: number; posters: (string | null)[] };

const yearOf = (v: Viewing) => (v.watchedOn ? Number(v.watchedOn.slice(0, 4)) : null);
const minutes = (rows: ViewingWithTitle[]) => rows.reduce((sum, r) => sum + (r.title.runtime ?? 0), 0);

/** A TV season's length: its episode count × the show's usual episode runtime. */
function seasonMinutes(r: ViewingWithTitle) {
  const episodes = r.title.seasons.find((s) => s.number === r.viewing.seasonNumber)?.episodeCount ?? 0;
  return episodes * (r.title.runtime ?? 0);
}

/** Your rating for a title in a year: the latest one you gave that year, else your latest overall. */
function ratingFor(yearRows: Viewing[], allRows: Viewing[]) {
  const latest = (list: Viewing[]) => [...list].sort(compareViewings).filter((v) => v.rating !== null).at(-1)?.rating ?? null;
  return latest(yearRows) ?? latest(allRows);
}

/** Every year with dated entries, newest first, with a few of that year's best-rated posters. */
export async function getRecapYears(userId: number): Promise<RecapYear[]> {
  const all = await getViewings(userId);
  const byYear = new Map<number, ViewingWithTitle[]>();
  for (const r of all) {
    const y = yearOf(r.viewing);
    if (y) byYear.set(y, [...(byYear.get(y) ?? []), r]);
  }
  return [...byYear.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, rows]) => {
      const movies = rows.filter((r) => r.title.mediaType === "movie");
      const best = [...new Map(movies.map((r) => [r.title.id, r])).values()].sort((a, b) => (b.viewing.rating ?? 0) - (a.viewing.rating ?? 0));
      return {
        year,
        films: new Set(movies.map((r) => r.title.id)).size,
        seasons: rows.length - movies.length,
        hours: Math.round((minutes(movies) + rows.filter((r) => r.title.mediaType === "tv").reduce((s, r) => s + seasonMinutes(r), 0)) / 60),
        posters: best.slice(0, 4).map((r) => r.title.posterPath),
      };
    });
}

/** Everything on one year's recap page for one person, or null if they logged nothing that year. */
export async function buildRecap(userId: number, year: number): Promise<Recap | null> {
  const db = await getDb();
  const [all, priorRows] = await Promise.all([
    getViewings(userId),
    db
      .select({ titleId: userTitles.titleId })
      .from(userTitles)
      .where(and(eq(userTitles.userId, userId), gt(userTitles.priorWatchCount, 0))),
  ]);
  const inYear = all.filter((r) => yearOf(r.viewing) === year).sort((a, b) => compareViewings(a.viewing, b.viewing));
  if (!inYear.length) return null;
  const movies = inYear.filter((r) => r.title.mediaType === "movie");
  const tv = inYear.filter((r) => r.title.mediaType === "tv");
  const seenBefore = new Set(priorRows.map((r) => r.titleId));
  const allByTitle = Map.groupBy(all, (r) => r.title.id);

  // --- Films, one entry each
  const films: RecapFilm[] = [...Map.groupBy(movies, (r) => r.title.id).values()].map((rows) => ({
    title: rows[0].title,
    rating: ratingFor(
      rows.map((r) => r.viewing),
      allByTitle.get(rows[0].title.id)!.map((r) => r.viewing),
    ),
    watches: rows.length,
    liked: rows.some((r) => r.viewing.liked),
    lastWatched: rows.at(-1)!.viewing.watchedOn!,
  }));
  const rated = films.filter((f) => f.rating !== null);
  const topFilms = [...films]
    .sort(
      (a, b) =>
        (b.rating ?? -1) - (a.rating ?? -1) ||
        Number(b.liked) - Number(a.liked) ||
        b.watches - a.watches ||
        b.lastWatched.localeCompare(a.lastWatched),
    )
    .slice(0, 10);

  // Seen for the first time this year: no earlier dated watch, no undated one, no "seen before" count, not a rewatch.
  const newToYou = films.filter((f) => {
    const history = allByTitle.get(f.title.id)!.map((r) => r.viewing);
    const first = movies.find((r) => r.title.id === f.title.id)!.viewing;
    return !seenBefore.has(f.title.id) && !first.isRewatch && history.every((v) => v.watchedOn && Number(v.watchedOn.slice(0, 4)) >= year);
  }).length;

  // --- People
  const filmIds = films.map((f) => f.title.id);
  const credits = await getCreditsFor(filmIds, ["director", "cast"]);
  const ratingOf = new Map(films.map((f) => [f.title.id, f.rating]));
  const titleById = new Map(films.map((f) => [f.title.id, f.title]));
  const favorite = (role: "director" | "cast"): RecapPerson | null => {
    const people = new Map<number, { name: string; profilePath: string | null; ids: Set<number> }>();
    for (const c of credits) {
      if (c.role !== role || (role === "cast" && c.order > 7)) continue;
      const p = people.get(c.personId) ?? { name: c.name, profilePath: c.profilePath, ids: new Set<number>() };
      p.ids.add(c.titleId);
      people.set(c.personId, p);
    }
    const ranked = [...people.entries()]
      .map(([id, p]) => {
        const ratings = [...p.ids].map((t) => ratingOf.get(t)).filter((r): r is number => r !== null && r !== undefined);
        return {
          id,
          name: p.name,
          profilePath: p.profilePath,
          count: p.ids.size,
          avg: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
          titles: [...p.ids].map((t) => titleById.get(t)!),
        };
      })
      .sort((a, b) => b.count - a.count || (b.avg ?? 0) - (a.avg ?? 0));
    // A "favorite" needs at least two films.
    return ranked[0] && ranked[0].count >= 2 ? ranked[0] : null;
  };

  // --- When
  const months = Array.from({ length: 12 }, (_, m) => movies.filter((r) => Number(r.viewing.watchedOn!.slice(5, 7)) === m + 1).length);
  const peak = Math.max(...months);
  const peakMonth = months.indexOf(peak);
  const uniqueTitles = (rows: ViewingWithTitle[]) => [...new Map(rows.map((r) => [r.title.id, r.title])).values()];
  const [dayDate, dayCount] = countBy(movies, (r) => r.viewing.watchedOn)[0] ?? [];
  const weekdays = Array.from({ length: 7 }, () => 0);
  for (const r of movies) weekdays[new Date(`${r.viewing.watchedOn}T00:00:00Z`).getUTCDay()]++;
  const firstMovie = movies[0];
  const lastMovie = movies.at(-1);

  // --- Taste
  const genres = countBy(
    films.flatMap((f) => f.title.genres.map((g) => g.name)),
    (g) => g,
  ).slice(0, 6) as [string, number][];
  const decades = countBy(films, (f) => (f.title.year ? Math.floor(f.title.year / 10) * 10 : null)).slice(0, 6) as [number, number][];
  const oldest = films.filter((f) => f.title.year).sort((a, b) => a.title.year! - b.title.year!)[0]?.title ?? null;
  const places = countBy(movies, (r) => r.viewing.watchedWhere).slice(0, 4) as [string, number][];
  const mostRewatched = [...films].sort((a, b) => b.watches - a.watches)[0];
  const gaps = rated
    .filter((f) => f.title.voteAverage)
    .map((f) => ({ title: f.title, rating: f.rating!, crowd: f.title.voteAverage!, gap: f.rating! - f.title.voteAverage! }))
    .sort((a, b) => b.gap - a.gap);
  const loved = gaps[0] && gaps[0].gap >= 1 ? gaps[0] : null;
  const hot = gaps.at(-1) && gaps.at(-1)!.gap <= -1 ? gaps.at(-1)! : null;

  // --- TV
  const shows = [...Map.groupBy(tv, (r) => r.title.id).values()].map((rows) => ({
    title: rows[0].title,
    rating: ratingFor(
      rows.map((r) => r.viewing),
      allByTitle.get(rows[0].title.id)!.map((r) => r.viewing),
    ),
    seasons: rows.length,
  }));

  // --- Last year, for comparison
  const prevMovies = all.filter((r) => yearOf(r.viewing) === year - 1 && r.title.mediaType === "movie");

  const toMoment = (r: ViewingWithTitle | undefined): RecapMoment | null => (r ? { title: r.title, date: r.viewing.watchedOn! } : null);
  return {
    year,
    films: films.length,
    watches: movies.length,
    hours: Math.round(minutes(movies) / 60),
    rewatches: movies.filter((r) => r.viewing.isRewatch).length,
    newToYou,
    avgRating: rated.length ? rated.reduce((s, f) => s + f.rating!, 0) / rated.length : null,
    rated: rated.length,
    topFilms,
    director: favorite("director"),
    actor: favorite("cast"),
    months,
    busiestMonth: peak > 0 ? { month: peakMonth, count: peak, titles: uniqueTitles(movies.filter((r) => Number(r.viewing.watchedOn!.slice(5, 7)) === peakMonth + 1)) } : null,
    busiestDay:
      dayDate && dayCount && dayCount > 1
        ? { date: String(dayDate), count: dayCount, titles: uniqueTitles(movies.filter((r) => r.viewing.watchedOn === dayDate)) }
        : null,
    weekdays,
    longestStreak: computeStreaks(
      inYear.map((r) => r.viewing.watchedOn!),
      `${year}-12-31`,
    ).longest,
    first: toMoment(firstMovie),
    last: firstMovie === lastMovie ? null : toMoment(lastMovie),
    genres,
    decades,
    oldest,
    places,
    mostRewatched: mostRewatched && mostRewatched.watches > 1 ? { title: mostRewatched.title, count: mostRewatched.watches } : null,
    lovedMore: loved && { title: loved.title, rating: loved.rating, crowd: loved.crowd },
    hotTake: hot && { title: hot.title, rating: hot.rating, crowd: hot.crowd },
    tv: {
      seasons: tv.length,
      shows: shows.length,
      hours: Math.round(tv.reduce((s, r) => s + seasonMinutes(r), 0) / 60),
      top: shows.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1) || b.seasons - a.seasons).slice(0, 5),
    },
    previous: prevMovies.length
      ? { year: year - 1, films: new Set(prevMovies.map((r) => r.title.id)).size, hours: Math.round(minutes(prevMovies) / 60) }
      : null,
  };
}
