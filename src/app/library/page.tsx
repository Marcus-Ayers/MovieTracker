import type { Metadata } from "next";
import { Suspense } from "react";
import { FilterBar, type FilterControl } from "@/components/filter-bar";
import { PosterCard } from "@/components/media/poster-card";
import { EmptyState, NoOwnerNotice, PageHeader, PageSkeleton, PrivateNotice } from "@/components/page";
import { getProfileAccess } from "@/lib/auth";
import { formatDate, plural } from "@/lib/format";
import { getLibrary, type LibraryEntry } from "@/lib/library";

export const metadata: Metadata = { title: "Library" };

const SORTS: { value: string; label: string; compare: (a: LibraryEntry, b: LibraryEntry) => number }[] = [
  { value: "recent", label: "Recently watched", compare: (a, b) => (b.lastWatched ?? "").localeCompare(a.lastWatched ?? "") },
  { value: "rating", label: "Your rating", compare: (a, b) => (b.rating ?? -1) - (a.rating ?? -1) },
  { value: "count", label: "Most watched", compare: (a, b) => b.watchCount - a.watchCount },
  { value: "title", label: "Title (A–Z)", compare: (a, b) => a.title.title.localeCompare(b.title.title) },
  { value: "year", label: "Release year", compare: (a, b) => (b.title.year ?? 0) - (a.title.year ?? 0) },
  { value: "runtime", label: "Runtime", compare: (a, b) => (b.title.runtime ?? 0) - (a.title.runtime ?? 0) },
  { value: "tmdb", label: "TMDB score", compare: (a, b) => (b.title.voteAverage ?? 0) - (a.title.voteAverage ?? 0) },
  { value: "loved", label: "You liked more than most", compare: (a, b) => gap(b) - gap(a) },
  { value: "hated", label: "You liked less than most", compare: (a, b) => gap(a) - gap(b) },
];

/** How far your rating is above the crowd's (TMDB average). */
function gap(e: LibraryEntry) {
  return e.rating === null || !e.title.voteAverage ? 0 : e.rating - e.title.voteAverage;
}

function subtitleFor(e: LibraryEntry, sort: string) {
  if (sort === "count") return plural(e.watchCount, "watch", "watches");
  if (sort === "loved" || sort === "hated") {
    if (e.rating === null || !e.title.voteAverage) return "";
    const diff = gap(e);
    return `You ${e.rating} · Avg ${e.title.voteAverage.toFixed(1)} (${diff > 0 ? "+" : ""}${diff.toFixed(1)})`;
  }
  if (sort === "tmdb") return e.title.voteAverage ? `TMDB ${e.title.voteAverage.toFixed(1)}` : "";
  return e.lastWatched ? formatDate(e.lastWatched)! : e.watchCount ? "Date unknown" : "";
}

async function Library({ searchParams }: { searchParams: PageProps<"/library">["searchParams"] }) {
  const access = await getProfileAccess();
  if (access.status === "no-owner") return <NoOwnerNotice />;
  if (access.status === "private") return <PrivateNotice name={access.owner.displayName} />;

  const params = await searchParams;
  const one = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : "");
  const type = one("type") || "all";
  const sort = SORTS.some((s) => s.value === one("sort")) ? one("sort") : "recent";
  const genre = one("genre");
  const decade = one("decade");
  const minRating = Number(one("min")) || 0;

  const library = await getLibrary(access.owner.id);
  const genres = [...new Set(library.flatMap((e) => e.title.genres.map((g) => g.name)))].sort();
  const decades = [...new Set(library.map((e) => (e.title.year ? Math.floor(e.title.year / 10) * 10 : null)).filter((d): d is number => d !== null))].sort((a, b) => b - a);

  const filtered = library
    .filter((e) => type === "all" || e.title.mediaType === type)
    .filter((e) => !genre || e.title.genres.some((g) => g.name === genre))
    .filter((e) => !decade || (e.title.year !== null && Math.floor(e.title.year / 10) * 10 === Number(decade)))
    .filter((e) => !minRating || (e.rating ?? 0) >= minRating)
    .sort(SORTS.find((s) => s.value === sort)!.compare);

  const controls: FilterControl[] = [
    { name: "type", label: "Type", value: type, options: [{ value: "all", label: "Movies & TV" }, { value: "movie", label: "Movies" }, { value: "tv", label: "TV Shows" }] },
    { name: "sort", label: "Sort", value: sort, options: SORTS.map((s) => ({ value: s.value, label: s.label })) },
    { name: "genre", label: "Genre", value: genre, options: [{ value: "", label: "All genres" }, ...genres.map((g) => ({ value: g, label: g }))] },
    { name: "decade", label: "Decade", value: decade, options: [{ value: "", label: "Any decade" }, ...decades.map((d) => ({ value: String(d), label: `${d}s` }))] },
    {
      name: "min",
      label: "Minimum rating",
      value: minRating ? String(minRating) : "",
      options: [{ value: "", label: "Any rating" }, ...[9, 8, 7, 6, 5].map((n) => ({ value: String(n), label: `${n}+ / 10` }))],
    },
  ];

  const movies = library.filter((e) => e.title.mediaType === "movie").length;

  return (
    <>
      <PageHeader
        title={access.isOwner ? "Your library" : `${access.owner.displayName}'s library`}
        subtitle={`${plural(movies, "movie")} · ${plural(library.length - movies, "show")}`}
      />
      <div className="px-4 sm:px-8 lg:px-12">
        <FilterBar controls={controls} className="mb-8" />
      </div>
      {filtered.length === 0 ? (
        <EmptyState title={library.length ? "Nothing matches those filters" : "Nothing logged yet"}>
          {library.length ? "Try loosening a filter." : "Search for something you've watched and hit Log."}
        </EmptyState>
      ) : (
        <div className="grid grid-cols-3 gap-x-3 gap-y-5 px-4 sm:grid-cols-4 sm:px-8 md:grid-cols-5 lg:grid-cols-6 lg:px-12 xl:grid-cols-8">
          {filtered.map((e) => (
            <PosterCard
              key={e.title.id}
              item={{ id: e.title.tmdbId, mediaType: e.title.mediaType, title: e.title.title, year: e.title.year, posterPath: e.title.posterPath, voteAverage: e.title.voteAverage }}
              myRating={e.rating}
              sizes="(min-width: 1280px) 12vw, (min-width: 768px) 18vw, 30vw"
              subtitle={subtitleFor(e, sort)}
            />
          ))}
        </div>
      )}
    </>
  );
}

export default function LibraryPage(props: PageProps<"/library">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Library searchParams={props.searchParams} />
    </Suspense>
  );
}
