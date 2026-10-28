import { getCurrentUser } from "@/lib/auth";
import { getFriendActivity, type FriendActivity } from "@/lib/friends";
import { genreNames } from "@/lib/genres";
import { getLibrary, getWatchlist, watchedKey } from "@/lib/library";
import { discover, getLogoPath, getMovieList, getTitleDetails, getTrending, type MediaItem } from "@/lib/tmdb";
import { Hero, HeroSkeleton, type HeroItem } from "../media/hero";
import type { PosterItem } from "../media/poster-card";
import { myRatingFor, PosterRow, RowSkeleton, Top10Row, type WatchedMap } from "../media/rows";
import { HideWatchedToggle } from "./hide-watched-toggle";

type RowDef = { title: string; kind: "poster" | "top10"; load: () => Promise<PosterItem[]>; href?: string; captions?: Record<string, string> };

// Talk shows, news, and soaps crowd out everything else in TMDB's TV lists.
const TV_NOISE = "10763,10766,10767";

const movieGenre = (id: number) => () =>
  discover("movie", { with_genres: id, sort_by: "popularity.desc", "vote_count.gte": 300 }).then((r) => r.items);
const hiddenGems = () =>
  discover("movie", {
    sort_by: "vote_average.desc",
    "vote_average.gte": 7.3,
    "vote_count.gte": 200,
    "vote_count.lte": 2000,
  }).then((r) => r.items);
const popularTv = () =>
  discover("tv", { sort_by: "popularity.desc", without_genres: TV_NOISE, "vote_count.gte": 200 }).then((r) => r.items);

const genreRow = (title: string, id: number): RowDef => ({ title, kind: "poster", load: movieGenre(id), href: `/movies?g=${id}&votes=300` });

const HOME_ROWS = {
  hero: () => getTrending("all", "day"),
  top: [
    { title: "Top 10 Movies This Week", kind: "top10", load: () => getTrending("movie", "week") },
    { title: "Trending Now", kind: "poster", load: () => getTrending("all", "day") },
    { title: "In Theaters Now", kind: "poster", load: () => getMovieList("now_playing") },
  ] satisfies RowDef[],
  bottom: [
    { title: "Top 10 Shows This Week", kind: "top10", load: () => getTrending("tv", "week") },
    { title: "Coming Soon to Theaters", kind: "poster", load: () => getMovieList("upcoming") },
    { title: "Popular Movies", kind: "poster", load: () => getMovieList("popular"), href: "/movies" },
    { title: "Popular on TV", kind: "poster", load: popularTv, href: "/tv" },
    { title: "Critically Acclaimed", kind: "poster", load: () => getMovieList("top_rated"), href: "/movies?sort=vote_average.desc&votes=2500" },
    { title: "Hidden Gems", kind: "poster", load: hiddenGems, href: "/movies?sort=vote_average.desc&score=7.5-10&votes=250" },
    genreRow("Action", 28),
    genreRow("Comedy", 35),
    genreRow("Horror", 27),
    genreRow("Sci-Fi", 878),
    genreRow("Animation", 16),
  ] satisfies RowDef[],
};

/** Friends' recent watches, one poster per title, captioned "Alex · 9/10" or "Alex +2". */
function friendsRow(activity: FriendActivity[]): RowDef | null {
  const byTitle = new Map<string, { item: PosterItem; names: string[]; rating: number | null }>();
  for (const { person, viewing, title: t } of activity) {
    const key = `${t.mediaType}-${t.tmdbId}`;
    const entry = byTitle.get(key) ?? {
      item: { id: t.tmdbId, mediaType: t.mediaType, title: t.title, year: t.year, posterPath: t.posterPath, voteAverage: t.voteAverage },
      names: [],
      rating: viewing.rating,
    };
    if (!entry.names.includes(person.displayName)) entry.names.push(person.displayName);
    byTitle.set(key, entry);
  }
  const rows = [...byTitle.entries()].slice(0, 20);
  if (!rows.length) return null;
  const captions = Object.fromEntries(
    rows.map(([key, { names, rating }]) => [
      key,
      names.length > 1 ? `${names[0]} +${names.length - 1}` : `${names[0]}${rating !== null ? ` · ${rating}/10` : ""}`,
    ]),
  );
  return { title: "What Friends Watched", kind: "poster", load: async () => rows.map(([, r]) => r.item), href: "/friends", captions };
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

/**
 * The home page: the hero carousel plus every row. Personal rows (your watchlist, "Because you rated…", what
 * friends watched) are added when you're signed in, and "Hide watched" filters the rest.
 */
export async function BrowseContent() {
  const user = await getCurrentUser();
  const showFriends = Boolean(user?.social && user.socialHome);
  const [library, watchlist, activity] = user
    ? await Promise.all([getLibrary(user.id), getWatchlist(user.id), showFriends ? getFriendActivity(user.id, 60) : []])
    : [[], [], []];
  const watched: WatchedMap | null = user
    ? Object.fromEntries(library.map((e) => [watchedKey(e.title.mediaType, e.title.tmdbId), e.rating]))
    : null;
  const hideWatched = Boolean(user?.hideWatched);

  const defs = HOME_ROWS;
  const personal: RowDef[] = [];

  const friends = friendsRow(activity);
  if (friends) personal.push(friends);

  const watchlistItems: PosterItem[] = watchlist.map((t) => ({ id: t.tmdbId, mediaType: t.mediaType, title: t.title, year: t.year, posterPath: t.posterPath, voteAverage: t.voteAverage }));
  if (watchlistItems.length) personal.push({ title: "From Your Watchlist", kind: "poster", load: async () => watchlistItems });

  // "Because you rated X" — your most recent 8+ rating.
  const favorite = library
    .filter((e) => (e.rating ?? 0) >= 8)
    .sort((a, b) => (b.lastWatched ?? "").localeCompare(a.lastWatched ?? ""))[0];
  if (favorite) {
    personal.push({
      title: `Because you rated ${favorite.title.title} ${favorite.rating}/10`,
      kind: "poster",
      load: () => getTitleDetails(favorite.title.mediaType, favorite.title.tmdbId).then((d) => d.recommendations),
    });
  }

  const allRows: RowDef[] = [...defs.top, ...personal, ...defs.bottom];
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
          return <PosterRow key={row.title} title={row.title} items={visible} watched={watched} href={row.href} captions={row.captions} />;
        })}
      </div>
    </>
  );
}

/** Grey placeholder for the home page while its rows load. */
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
