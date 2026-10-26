import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { loadDiscover } from "@/lib/discover";
import { DEFAULT_MIN_VOTES, parseFilters, RUNTIME_MAX, toQuery, TV_NOISE_GENRES, type DiscoverFilters } from "@/lib/discover-filters";
import type { MediaType } from "@/lib/format";
import { getWatchedMap } from "@/lib/library";
import { getKeyword, getPersonBasic, getWatchProviders, hasTmdbKey } from "@/lib/tmdb";
import { MissingKey } from "../missing-key";
import { DiscoverResults } from "./discover-results";
import { DiscoverSidebar } from "./discover-sidebar";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function activeFilterCount(f: DiscoverFilters) {
  const defaultExclude = f.media === "tv" ? TV_NOISE_GENRES.length : 0;
  return [
    f.sort !== "popularity.desc",
    f.genres.length > 0 || f.excludeGenres.length !== defaultExclude,
    f.from || f.to,
    f.scoreMin > 0 || f.scoreMax < 10,
    f.minVotes !== DEFAULT_MIN_VOTES,
    f.runtimeMin > 0 || f.runtimeMax < RUNTIME_MAX,
    f.providers.length || f.monetization.length,
    f.language,
    f.certifications.length,
    f.keywords.length,
    f.people.length,
    f.hideSeen,
  ].filter(Boolean).length;
}

async function DiscoverContent({ media, searchParams }: { media: MediaType; searchParams: SearchParams }) {
  const filters = parseFilters(media, await searchParams);
  const query = toQuery(filters);
  const user = await getCurrentUser();
  const [watched, providers, keywords, people] = await Promise.all([
    user ? getWatchedMap(user.id) : null,
    getWatchProviders(media).catch(() => []),
    Promise.all(filters.keywords.map((id) => getKeyword(id))),
    Promise.all(filters.people.map((id) => getPersonBasic(id))),
  ]);
  const first = await loadDiscover(filters, 1, watched);

  return (
    <div className="flex gap-8 px-4 pb-10 sm:px-8 lg:px-12">
      <DiscoverSidebar
        filters={filters}
        providers={providers}
        keywords={keywords.filter((k) => k !== null)}
        people={people.filter((p) => p !== null).map((p) => ({ id: p.id, name: p.name }))}
        loggedIn={Boolean(user)}
        activeCount={activeFilterCount(filters)}
      />
      {/* Keyed by the query so new filters start a fresh list. */}
      <DiscoverResults
        key={query}
        media={media}
        query={query}
        view={filters.view}
        initial={first.items}
        nextPage={first.nextPage}
        totalResults={first.totalResults}
        hideSeen={filters.hideSeen && Boolean(user)}
      />
    </div>
  );
}

function DiscoverSkeleton() {
  return (
    <div className="flex gap-8 px-4 sm:px-8 lg:px-12">
      <div className="hidden h-[70vh] w-72 shrink-0 animate-pulse rounded-xl bg-surface lg:block" />
      <div className="grid flex-1 grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} className="aspect-[2/3] animate-pulse rounded-lg bg-surface-2" />
        ))}
      </div>
    </div>
  );
}

export function DiscoverView({ media, searchParams }: { media: MediaType; searchParams: SearchParams }) {
  if (!hasTmdbKey()) return <MissingKey />;
  return (
    <>
      <header className="px-4 pb-6 pt-28 sm:px-8 lg:px-12">
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">{media === "movie" ? "Movies" : "TV Shows"}</h1>
        <p className="mt-1 text-muted">
          {media === "movie"
            ? "Every movie on TMDB. Filter by decade, genre, score, runtime, streaming service and more."
            : "Every show on TMDB. Filter by genre, score, streaming service and more."}
        </p>
      </header>
      <Suspense fallback={<DiscoverSkeleton />}>
        <DiscoverContent media={media} searchParams={searchParams} />
      </Suspense>
    </>
  );
}
