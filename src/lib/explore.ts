import "server-only";
import { getCreditsFor, getLibrary, watchedKey, type LibraryEntry } from "./library";
import { getExternalRatings, type ExternalRatings } from "./ratings";
import { discover, getMovieDetails, getPerson, getTrending, type MediaItem, type TitleDetails } from "./tmdb";

export type ExploreRow = { key: string; title: string; subtitle?: string; items: MediaItem[]; href?: string };
export type ExplorePick = { details: TitleDetails; ratings: ExternalRatings | null; reason: string };
export type Explore = { pick: ExplorePick | null; rows: ExploreRow[]; watched: Record<string, number | null> | null };

/** Small seeded random generator, so a given "shuffle" always shows the same page. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const shuffle = <T>(items: T[], rand: () => number) => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};
const randInt = (rand: () => number, min: number, max: number) => min + Math.floor(rand() * (max - min + 1));

const ROULETTE_GENRES: [number, string][] = [
  [53, "Thrillers"],
  [35, "Comedies"],
  [27, "Horror"],
  [878, "Sci-Fi"],
  [80, "Crime"],
  [18, "Dramas"],
  [37, "Westerns"],
  [10752, "War Movies"],
  [10749, "Romance"],
  [9648, "Mysteries"],
  [12, "Adventures"],
  [16, "Animation"],
  [28, "Action"],
  [14, "Fantasy"],
];

const today = () => new Date().toISOString().slice(0, 10);

/** A fresh shuffle for a visit to /explore without one. */
export function randomSeed() {
  return Math.floor(Math.random() * 1_000_000_000);
}

export async function buildExplore(seed: number, userId: number | null): Promise<Explore> {
  // Each section gets its own random stream, so sections don't affect each other's picks.
  const rng = (n: number) => seeded(seed * 31 + n * 7919);
  const library = userId ? await getLibrary(userId) : [];
  const watched = userId ? Object.fromEntries(library.map((e) => [watchedKey(e.title.mediaType, e.title.tmdbId), e.rating])) : null;
  const unseen = (items: MediaItem[]) => (watched ? items.filter((i) => !(watchedKey(i.mediaType, i.id) in watched)) : items);
  const movies = library.filter((e) => e.title.mediaType === "movie");

  const sections: Promise<ExploreRow | ExploreRow[] | null>[] = [];
  let recommended: Promise<ExploreRow | null> = Promise.resolve(null);
  if (movies.length >= 3) {
    recommended = recommendedForYou(movies, rng(1), unseen);
    sections.push(recommended, becauseYouWatched(movies, unseen), peopleRows(movies, rng(2), unseen), genreRows(movies, rng(3), unseen));
  }
  const random = randomPicks(rng(5), unseen);
  sections.push(classics(rng(4), unseen), random, roulette(rng(6), unseen), hiddenGems(rng(7), unseen), trending());

  const rows = (await Promise.all(sections.map((s) => s.catch(() => null))))
    .flat()
    .filter((r): r is ExploreRow => r !== null && r.items.length >= 4);

  const pick = await surprisePick(rng(8), await recommended.catch(() => null), await random.catch(() => null));
  return { pick, rows, watched };
}

// ---------------------------------------------------------------------------
// Personal sections
// ---------------------------------------------------------------------------

/** Pools TMDB recommendations from a sample of your 8+ / liked movies and ranks what comes up most. */
async function recommendedForYou(movies: LibraryEntry[], rand: () => number, unseen: (i: MediaItem[]) => MediaItem[]): Promise<ExploreRow | null> {
  const loved = movies.filter((e) => (e.rating ?? 0) >= 8 || e.liked);
  if (!loved.length) return null;
  const seeds = shuffle(loved, rand).slice(0, 8);
  const details = await Promise.all(seeds.map((e) => getMovieDetails(e.title.tmdbId).catch(() => null)));
  const scores = new Map<number, { item: MediaItem; score: number }>();
  details.forEach((d, i) => {
    const weight = (seeds[i].rating ?? 8) - 5;
    d?.recommendations.forEach((item, position) => {
      const entry = scores.get(item.id) ?? { item, score: 0 };
      entry.score += weight + (20 - position) * 0.05;
      scores.set(item.id, entry);
    });
  });
  const items = unseen([...scores.values()].sort((a, b) => b.score - a.score).map((e) => e.item)).slice(0, 24);
  const names = seeds.slice(0, 3).map((e) => e.title.title);
  return {
    key: "recommended",
    title: "Recommended for you",
    subtitle: `Based on ${names.join(", ")}${seeds.length > 3 ? " and more you loved" : ""}`,
    items,
  };
}

async function becauseYouWatched(movies: LibraryEntry[], unseen: (i: MediaItem[]) => MediaItem[]): Promise<ExploreRow | null> {
  const latest = movies.filter((e) => e.lastWatched).sort((a, b) => b.lastWatched!.localeCompare(a.lastWatched!))[0];
  if (!latest) return null;
  const d = await getMovieDetails(latest.title.tmdbId);
  return {
    key: "because",
    title: `Because you watched ${latest.title.title}`,
    items: unseen(d.recommendations),
    href: `/movie/${latest.title.tmdbId}`,
  };
}

/** Unseen films from directors and actors who show up a lot in your library. */
async function peopleRows(movies: LibraryEntry[], rand: () => number, unseen: (i: MediaItem[]) => MediaItem[]): Promise<ExploreRow[]> {
  const ratingOf = new Map(movies.map((e) => [e.title.id, e.rating]));
  // For actors, a film series counts once (all Harry Potter films = 1), same as on the Stats page.
  const seriesOf = new Map(movies.map((e) => [e.title.id, e.title.collectionId ? `series-${e.title.collectionId}` : `title-${e.title.id}`]));
  const credits = await getCreditsFor(movies.map((e) => e.title.id), ["director", "cast"]);
  const tally = (role: "director" | "cast", maxOrder: number) => {
    const people = new Map<number, { name: string; titles: Set<number> }>();
    for (const c of credits) {
      if (c.role !== role || c.order > maxOrder) continue;
      const p = people.get(c.personId) ?? { name: c.name, titles: new Set<number>() };
      p.titles.add(c.titleId);
      people.set(c.personId, p);
    }
    return [...people.entries()].map(([id, p]) => {
      const ratings = [...p.titles].map((t) => ratingOf.get(t)).filter((r): r is number => r != null);
      const avg = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;
      const count = role === "cast" ? new Set([...p.titles].map((t) => seriesOf.get(t))).size : p.titles.size;
      return { id, name: p.name, count, films: p.titles.size, avg };
    });
  };
  const rank = (p: { count: number; avg: number | null }) => (p.avg ?? 6) * 2 + p.count;
  const directors = shuffle(tally("director", 99).filter((p) => p.count >= 2).sort((a, b) => rank(b) - rank(a)).slice(0, 6), rand).slice(0, 2);
  const actors = shuffle(tally("cast", 3).filter((p) => p.count >= 3).sort((a, b) => rank(b) - rank(a)).slice(0, 8), rand).slice(0, 1);

  const released = today();
  const build = async (p: { id: number; name: string; films: number; avg: number | null }, kind: "director" | "actor") => {
    const person = await getPerson(p.id);
    const credits = (kind === "director" ? person.directing : person.acting).filter(
      (c) => c.mediaType === "movie" && c.date && c.date <= released && c.voteCount >= 100,
    );
    const items = unseen(credits).sort((a, b) => b.voteCount - a.voteCount).slice(0, 20);
    const avg = p.avg !== null ? ` · you average ${p.avg.toFixed(1)}/10` : "";
    return {
      key: `${kind}-${p.id}`,
      title: kind === "director" ? `More from ${p.name}` : `${p.name} movies you haven't seen`,
      subtitle: `You've seen ${p.films} of their films${avg}`,
      items,
      href: `/person/${p.id}`,
    } satisfies ExploreRow;
  };
  const rows = await Promise.all([
    ...directors.map((d) => build(d, "director").catch(() => null)),
    ...actors.map((a) => build(a, "actor").catch(() => null)),
  ]);
  return rows.filter((r) => r !== null);
}

/** Highly rated, unseen films in the genres you rate best. */
async function genreRows(movies: LibraryEntry[], rand: () => number, unseen: (i: MediaItem[]) => MediaItem[]): Promise<ExploreRow[]> {
  const stats = new Map<number, { name: string; count: number; total: number; rated: number }>();
  for (const e of movies) {
    for (const g of e.title.genres) {
      const s = stats.get(g.id) ?? { name: g.name, count: 0, total: 0, rated: 0 };
      s.count++;
      if (e.rating !== null) {
        s.total += e.rating;
        s.rated++;
      }
      stats.set(g.id, s);
    }
  }
  const favorites = [...stats.entries()]
    .filter(([, s]) => s.count >= 5 && s.rated > 0)
    .sort((a, b) => b[1].total / b[1].rated - a[1].total / a[1].rated)
    .slice(0, 4);
  const chosen = shuffle(favorites, rand).slice(0, 2);
  return Promise.all(
    chosen.map(async ([id, s]) => {
      const page = randInt(rand, 1, 3);
      const res = await discover("movie", { with_genres: id, sort_by: "vote_average.desc", "vote_count.gte": 1000 }, page);
      return {
        key: `genre-${id}`,
        title: `Top-rated ${s.name} you haven't seen`,
        subtitle: `You average ${(s.total / s.rated).toFixed(1)}/10 on ${s.name.toLowerCase()}`,
        items: unseen(res.items),
        href: `/movies?g=${id}&sort=vote_average.desc&votes=1000&hide=seen`,
      };
    }),
  );
}

// ---------------------------------------------------------------------------
// Discovery sections (also shown to visitors)
// ---------------------------------------------------------------------------

async function classics(rand: () => number, unseen: (i: MediaItem[]) => MediaItem[]): Promise<ExploreRow> {
  const res = await discover(
    "movie",
    { "primary_release_date.lte": "1979-12-31", "vote_count.gte": 1500, sort_by: "vote_average.desc" },
    randInt(rand, 1, 3),
  );
  return {
    key: "classics",
    title: "Classics you haven't seen",
    subtitle: "Acclaimed films from before 1980",
    items: unseen(res.items),
    href: "/movies?sort=vote_average.desc&to=1979&votes=1000&hide=seen",
  };
}

async function roulette(rand: () => number, unseen: (i: MediaItem[]) => MediaItem[]): Promise<ExploreRow> {
  const decade = randInt(rand, 194, 201) * 10;
  const [genre, label] = ROULETTE_GENRES[Math.floor(rand() * ROULETTE_GENRES.length)];
  const res = await discover("movie", {
    with_genres: genre,
    "primary_release_date.gte": `${decade}-01-01`,
    "primary_release_date.lte": `${decade + 9}-12-31`,
    "vote_count.gte": 300,
    sort_by: "vote_average.desc",
  });
  return {
    key: "roulette",
    title: `Roulette: ${decade}s ${label}`,
    subtitle: "A random decade and genre — shuffle for another",
    items: unseen(res.items),
    href: `/movies?g=${genre}&from=${decade}&to=${decade + 9}&sort=vote_average.desc&votes=300&hide=seen`,
  };
}

async function randomPicks(rand: () => number, unseen: (i: MediaItem[]) => MediaItem[]): Promise<ExploreRow> {
  const pages = [randInt(rand, 1, 30), randInt(rand, 31, 60)];
  const results = await Promise.all(pages.map((p) => discover("movie", { "vote_count.gte": 2000, sort_by: "popularity.desc" }, p)));
  return {
    key: "random",
    title: "Random picks",
    subtitle: "Well-known movies, chosen at random",
    items: shuffle(unseen(results.flatMap((r) => r.items)), rand).slice(0, 24),
  };
}

async function hiddenGems(rand: () => number, unseen: (i: MediaItem[]) => MediaItem[]): Promise<ExploreRow> {
  const res = await discover(
    "movie",
    { sort_by: "vote_average.desc", "vote_average.gte": 7.3, "vote_count.gte": 200, "vote_count.lte": 2000 },
    randInt(rand, 1, 5),
  );
  return {
    key: "gems",
    title: "Hidden gems",
    subtitle: "Loved by the people who've seen them — which isn't many",
    items: unseen(res.items),
    href: "/movies?sort=vote_average.desc&score=7.5-10&votes=250&hide=seen",
  };
}

async function trending(): Promise<ExploreRow> {
  return { key: "trending", title: "Trending this week", items: await getTrending("movie", "week"), href: "/movies" };
}

/** The big card at the top: one of your recommendations, or a random well-known film. */
async function surprisePick(rand: () => number, recommended: ExploreRow | null, random: ExploreRow | null): Promise<ExplorePick | null> {
  const fromRecs = (recommended?.items ?? []).slice(0, 12).filter((i) => i.backdropPath);
  const fromRandom = (random?.items ?? []).filter((i) => i.backdropPath);
  const useRecs = fromRecs.length > 0 && (fromRandom.length === 0 || rand() < 0.6);
  const pool = useRecs ? fromRecs : fromRandom;
  if (!pool.length) return null;
  const choice = pool[Math.floor(rand() * pool.length)];
  try {
    const details = await getMovieDetails(choice.id);
    const ratings = await getExternalRatings(details.imdbId).catch(() => null);
    return { details, ratings, reason: useRecs ? "Recommended for you" : "Random pick" };
  } catch {
    return null;
  }
}
