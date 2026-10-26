import { getCurrentUser } from "@/lib/auth";
import { genreNames } from "@/lib/genres";
import { getLibrary, getWatchlist, watchedKey } from "@/lib/library";
import { discover, getLogoPath, getMovieList, getTitleDetails, getTrending, getTvList, type MediaItem } from "@/lib/tmdb";
import { Hero, HeroSkeleton, type HeroItem } from "../media/hero";
import type { PosterItem } from "../media/poster-card";
import { myRatingFor, PosterRow, RowSkeleton, Top10Row, type WatchedMap } from "../media/rows";
import { HideWatchedToggle } from "./hide-watched-toggle";

export type BrowseMode = "all" | "movie" | "tv";

type RowDef = { title: string; kind: "poster" | "top10"; load: () => Promise<PosterItem[]> };

// Talk shows, news, and soaps crowd out everything else in TMDB's TV lists.
const TV_NOISE = "10763,10766,10767";

const movieGenre = (id: number) => () =>
  discover("movie", { with_genres: id, sort_by: "popularity.desc", "vote_count.gte": 300 }).then((r) => r.items);
const tvGenre = (id: number) => () =>
  discover("tv", { with_genres: id, without_genres: TV_NOISE, sort_by: "popularity.desc", "vote_count.gte": 100 }).then(
    (r) => r.items,
  );
const hiddenGems = () =>
  discover("movie", {
    sort_by: "vote_average.desc",
    "vote_average.gte": 7.3,
    "vote_count.gte": 200,
    "vote_count.lte": 2000,
  }).then((r) => r.items);
const popularTv = () =>
  discover("tv", { sort_by: "popularity.desc", without_genres: TV_NOISE, "vote_count.gte": 200 }).then((r) => r.items);

function rowsFor(mode: BrowseMode): { hero: () => Promise<MediaItem[]>; top: RowDef[]; bottom: RowDef[] } {
  if (mode === "movie") {
    return {
      hero: () => getTrending("movie", "day"),
      top: [
        { title: "Top 10 Movies This Week", kind: "top10", load: () => getTrending("movie", "week") },
        { title: "In Theaters Now", kind: "poster", load: () => getMovieList("now_playing") },
      ],
      bottom: [
        { title: "Coming Soon", kind: "poster", load: () => getMovieList("upcoming") },
        { title: "Popular Movies", kind: "poster", load: () => getMovieList("popular") },
        { title: "Critically Acclaimed", kind: "poster", load: () => getMovieList("top_rated") },
        { title: "Hidden Gems", kind: "poster", load: hiddenGems },
        { title: "Action", kind: "poster", load: movieGenre(28) },
        { title: "Comedy", kind: "poster", load: movieGenre(35) },
        { title: "Thrillers", kind: "poster", load: movieGenre(53) },
        { title: "Horror", kind: "poster", load: movieGenre(27) },
        { title: "Sci-Fi", kind: "poster", load: movieGenre(878) },
        { title: "Drama", kind: "poster", load: movieGenre(18) },
        { title: "Animation", kind: "poster", load: movieGenre(16) },
        { title: "Crime", kind: "poster", load: movieGenre(80) },
        { title: "Romance", kind: "poster", load: movieGenre(10749) },
        { title: "Documentaries", kind: "poster", load: movieGenre(99) },
      ],
    };
  }
  if (mode === "tv") {
    return {
      hero: () => getTrending("tv", "day"),
      top: [
        { title: "Top 10 Shows This Week", kind: "top10", load: () => getTrending("tv", "week") },
        { title: "Airing This Week", kind: "poster", load: () => getTvList("on_the_air") },
      ],
      bottom: [
        { title: "Popular on TV", kind: "poster", load: popularTv },
        { title: "Top Rated Shows", kind: "poster", load: () => getTvList("top_rated") },
        { title: "Drama", kind: "poster", load: tvGenre(18) },
        { title: "Comedy", kind: "poster", load: tvGenre(35) },
        { title: "Crime", kind: "poster", load: tvGenre(80) },
        { title: "Sci-Fi & Fantasy", kind: "poster", load: tvGenre(10765) },
        { title: "Action & Adventure", kind: "poster", load: tvGenre(10759) },
        { title: "Animation", kind: "poster", load: tvGenre(16) },
        { title: "Mystery", kind: "poster", load: tvGenre(9648) },
        { title: "Docuseries", kind: "poster", load: tvGenre(99) },
        { title: "Reality", kind: "poster", load: tvGenre(10764) },
      ],
    };
  }
  return {
    hero: () => getTrending("all", "day"),
    top: [
      { title: "Top 10 Movies This Week", kind: "top10", load: () => getTrending("movie", "week") },
      { title: "Trending Now", kind: "poster", load: () => getTrending("all", "day") },
      { title: "In Theaters Now", kind: "poster", load: () => getMovieList("now_playing") },
    ],
    bottom: [
      { title: "Top 10 Shows This Week", kind: "top10", load: () => getTrending("tv", "week") },
      { title: "Coming Soon to Theaters", kind: "poster", load: () => getMovieList("upcoming") },
      { title: "Popular Movies", kind: "poster", load: () => getMovieList("popular") },
      { title: "Popular on TV", kind: "poster", load: popularTv },
      { title: "Critically Acclaimed", kind: "poster", load: () => getMovieList("top_rated") },
      { title: "Hidden Gems", kind: "poster", load: hiddenGems },
      { title: "Action", kind: "poster", load: movieGenre(28) },
      { title: "Comedy", kind: "poster", load: movieGenre(35) },
      { title: "Horror", kind: "poster", load: movieGenre(27) },
      { title: "Sci-Fi", kind: "poster", load: movieGenre(878) },
      { title: "Animation", kind: "poster", load: movieGenre(16) },
    ],
  };
}

async function buildHero(items: MediaItem[], watched: WatchedMap | null): Promise<HeroItem[]> {
  const picks = items.filter((i) => i.backdropPath && i.overview).slice(0, 6);
  return Promise.all(
    picks.map(async (item) => ({
      id: item.id,
      mediaType: item.mediaType,
      title: item.title,
      year: item.year,
      overview: item.overview,
      backdropPath: item.backdropPath!,
      logoPath: await getLogoPath(item.mediaType, item.id).catch(() => null),
      voteAverage: item.voteAverage,
      genres: genreNames(item.mediaType, item.genreIds),
      myRating: myRatingFor(watched, item),
    })),
  );
}

export async function BrowseContent({ mode }: { mode: BrowseMode }) {
  const user = await getCurrentUser();
  const [library, watchlist] = user ? await Promise.all([getLibrary(user.id), getWatchlist(user.id)]) : [[], []];
  const watched: WatchedMap | null = user
    ? Object.fromEntries(library.map((e) => [watchedKey(e.title.mediaType, e.title.tmdbId), e.rating]))
    : null;
  const hideWatched = Boolean(user?.hideWatched);

  const defs = rowsFor(mode);
  const personal: RowDef[] = [];
  const inMode = (mt: "movie" | "tv") => mode === "all" || mode === mt;

  const watchlistItems: PosterItem[] = watchlist
    .filter((t) => inMode(t.mediaType))
    .map((t) => ({ id: t.tmdbId, mediaType: t.mediaType, title: t.title, year: t.year, posterPath: t.posterPath, voteAverage: t.voteAverage }));
  if (watchlistItems.length) personal.push({ title: "From Your Watchlist", kind: "poster", load: async () => watchlistItems });

  // "Because you rated X" — your most recent 8+ rating.
  const favorite = library
    .filter((e) => inMode(e.title.mediaType) && (e.rating ?? 0) >= 8)
    .sort((a, b) => (b.lastWatched ?? "").localeCompare(a.lastWatched ?? ""))[0];
  if (favorite) {
    personal.push({
      title: `Because you rated ${favorite.title.title} ${favorite.rating}/10`,
      kind: "poster",
      load: () => getTitleDetails(favorite.title.mediaType, favorite.title.tmdbId).then((d) => d.recommendations),
    });
  }

  const allRows = [...defs.top, ...personal, ...defs.bottom];
  const [heroSource, ...rowItems] = await Promise.all([
    defs.hero().catch(() => [] as MediaItem[]),
    ...allRows.map((row) => row.load().catch(() => [] as PosterItem[])),
  ]);
  const heroItems = await buildHero(heroSource, watched);

  return (
    <>
      <Hero items={heroItems} />
      <div className="relative z-10 -mt-20 space-y-6 sm:-mt-28 sm:space-y-9">
        {user && (
          <div className="flex justify-end px-4 sm:px-8 lg:px-12">
            <HideWatchedToggle hidden={hideWatched} />
          </div>
        )}
        {allRows.map((row, i) => {
          const items = rowItems[i];
          if (row.kind === "top10") return <Top10Row key={row.title} title={row.title} items={items} watched={watched} />;
          const visible = hideWatched ? items.filter((item) => myRatingFor(watched, item) === undefined) : items;
          return <PosterRow key={row.title} title={row.title} items={visible} watched={watched} />;
        })}
      </div>
    </>
  );
}

export function BrowseSkeleton() {
  return (
    <>
      <HeroSkeleton />
      <div className="relative z-10 -mt-20 space-y-9 sm:-mt-28">
        <RowSkeleton />
        <RowSkeleton />
        <RowSkeleton />
      </div>
    </>
  );
}
