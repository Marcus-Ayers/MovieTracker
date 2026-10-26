import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FilterBar, RatingFilter, type FilterControl } from "@/components/filter-bar";
import { PosterCard } from "@/components/media/poster-card";
import { EmptyState, NoOwnerNotice, PageHeader, PageSkeleton, PrivateNotice } from "@/components/page";
import { getProfileAccess } from "@/lib/auth";
import { formatDate, plural } from "@/lib/format";
import { getCreditsFor, getLibrary, type LibraryEntry } from "@/lib/library";
import { MONTHS_LONG } from "@/lib/stats";

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

function subtitleFor(e: LibraryEntry, sort: string, director: string | undefined) {
  if (sort === "count") return plural(e.watchCount, "watch", "watches");
  if (sort === "loved" || sort === "hated") {
    if (e.rating === null || !e.title.voteAverage) return "";
    const diff = gap(e);
    return `You ${e.rating} · Avg ${e.title.voteAverage.toFixed(1)} (${diff > 0 ? "+" : ""}${diff.toFixed(1)})`;
  }
  if (sort === "tmdb") return e.title.voteAverage ? `TMDB ${e.title.voteAverage.toFixed(1)}` : "";
  return [e.title.year, director].filter(Boolean).join(" · ");
}

/** Shown in the hover preview: how often / when you watched it. */
function noteFor(e: LibraryEntry) {
  const parts: string[] = [];
  if (e.watchCount > 1) parts.push(`Watched ${e.watchCount}×`);
  if (e.lastWatched) parts.push(`${e.watchCount > 1 ? "last" : "Watched"} ${formatDate(e.lastWatched)}`);
  return parts.join(" · ") || undefined;
}

const ratingKey = (e: LibraryEntry) => (e.rating === null ? "none" : String(e.rating));

/** "2026" → "2026", "2026-10" → "October 2026" */
function periodLabel(period: string) {
  return period.length === 7 ? `${MONTHS_LONG[Number(period.slice(5)) - 1]} ${period.slice(0, 4)}` : period;
}

async function Library({ searchParams }: { searchParams: PageProps<"/library">["searchParams"] }) {
  const access = await getProfileAccess();
  if (access.status === "no-owner") return <NoOwnerNotice />;
  if (access.status === "private") return <PrivateNotice name={access.owner.displayName} />;

  const raw = await searchParams;
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) if (typeof value === "string" && value) params[key] = value;

  const type = params.type === "movie" || params.type === "tv" ? params.type : "all";
  const sort = SORTS.some((s) => s.value === params.sort) ? params.sort : "recent";
  const genre = params.genre ?? "";
  const decade = params.decade ?? "";
  const watched = /^\d{4}(-\d{2})?$/.test(params.watched ?? "") ? params.watched : "";
  // ?r=7,8,9,10 — any set of ratings. (Older ?min=7 links still work.)
  const ratings = params.r
    ? params.r.split(",").filter((v) => v === "none" || /^(10|[1-9])$/.test(v))
    : params.min
      ? Array.from({ length: 11 - Number(params.min) }, (_, i) => String(Number(params.min) + i)).filter((v) => Number(v) <= 10)
      : [];

  const library = await getLibrary(access.owner.id);
  // Director (movies) or creator (TV) for the line under each poster.
  const directorOf = new Map<number, string>();
  for (const c of (await getCreditsFor(library.map((e) => e.title.id), ["director", "creator"])).sort((a, b) => a.order - b.order)) {
    if (!directorOf.has(c.titleId)) directorOf.set(c.titleId, c.name);
  }
  const genres = [...new Set(library.flatMap((e) => e.title.genres.map((g) => g.name)))].sort();
  const decades = [...new Set(library.map((e) => (e.title.year ? Math.floor(e.title.year / 10) * 10 : null)).filter((d): d is number => d !== null))].sort((a, b) => b - a);
  const watchedYears = [...new Set(library.flatMap((e) => e.viewings.map((v) => v.watchedOn?.slice(0, 4)).filter((y): y is string => Boolean(y))))].sort().reverse();

  // Everything except the rating filter, so the rating chips can show how many titles each rating has.
  const base = library
    .filter((e) => type === "all" || e.title.mediaType === type)
    .filter((e) => !genre || e.title.genres.some((g) => g.name === genre))
    .filter((e) => !decade || (e.title.year !== null && Math.floor(e.title.year / 10) * 10 === Number(decade)))
    .filter((e) => !watched || e.viewings.some((v) => v.watchedOn?.startsWith(watched)));
  const ratingCounts: Record<string, number> = {};
  for (const e of base) ratingCounts[ratingKey(e)] = (ratingCounts[ratingKey(e)] ?? 0) + 1;
  const filtered = base.filter((e) => !ratings.length || ratings.includes(ratingKey(e))).sort(SORTS.find((s) => s.value === sort)!.compare);

  const watchedOptions = [{ value: "", label: "Watched any time" }, ...watchedYears.map((y) => ({ value: y, label: `Watched in ${y}` }))];
  if (watched.length === 7) watchedOptions.push({ value: watched, label: `Watched in ${periodLabel(watched)}` });

  const controls: FilterControl[] = [
    { name: "type", label: "Type", value: type, options: [{ value: "all", label: "Movies & TV" }, { value: "movie", label: "Movies" }, { value: "tv", label: "TV Shows" }] },
    { name: "sort", label: "Sort", value: sort, options: SORTS.map((s) => ({ value: s.value, label: s.label })) },
    { name: "genre", label: "Genre", value: genre, options: [{ value: "", label: "All genres" }, ...genres.map((g) => ({ value: g, label: g }))] },
    { name: "decade", label: "Decade", value: decade, options: [{ value: "", label: "Any decade" }, ...decades.map((d) => ({ value: String(d), label: `${d}s` }))] },
    { name: "watched", label: "Watched", value: watched, options: watchedOptions },
  ];
  const filtering = filtered.length !== library.length;
  const movies = library.filter((e) => e.title.mediaType === "movie").length;

  return (
    <>
      <PageHeader
        title={access.isOwner ? "Your library" : `${access.owner.displayName}'s library`}
        subtitle={
          filtering ? (
            <>
              Showing {plural(filtered.length, "title")} of {library.length.toLocaleString()} ·{" "}
              <Link href="/library" className="text-fg underline decoration-accent underline-offset-4">
                Clear filters
              </Link>
            </>
          ) : (
            `${plural(movies, "movie")} · ${plural(library.length - movies, "show")}`
          )
        }
      />
      <div className="space-y-4 px-4 pb-8 sm:px-8 lg:px-12">
        <FilterBar controls={controls} params={params} />
        <RatingFilter selected={ratings} counts={ratingCounts} params={params} />
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
              item={{
                id: e.title.tmdbId,
                mediaType: e.title.mediaType,
                title: e.title.title,
                year: e.title.year,
                posterPath: e.title.posterPath,
                genres: e.title.genres.map((g) => g.name),
              }}
              myRating={e.rating}
              sizes="(min-width: 1280px) 12vw, (min-width: 768px) 18vw, 30vw"
              subtitle={subtitleFor(e, sort, directorOf.get(e.title.id))}
              note={noteFor(e)}
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
