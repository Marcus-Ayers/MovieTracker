import { format } from "date-fns";
import Link from "next/link";
import { FilterBar, type FilterControl } from "@/components/filter-bar";
import { PosterCard } from "@/components/media/poster-card";
import { EmptyState, PageHeader } from "@/components/page";
import { ProfileTabs, type ProfileViewProps } from "@/components/profile/profile-nav";
import { PickForMe, type PickItem } from "@/components/watchlist/pick-for-me";
import type { Title } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { formatRuntime, plural } from "@/lib/format";
import { getWatchlistEntries } from "@/lib/library";
import { getSavedImdbScores } from "@/lib/ratings";
import { expandServices, serviceKey } from "@/lib/services";
import { getStreamingProviders, type WatchProvider } from "@/lib/tmdb";

type Entry = {
  title: Title;
  addedAt: Date | null;
  /** IMDb if known, else TMDB's average. */
  score: number | null;
  scoreLabel: string | null;
  /** Which of the viewer's streaming services have it. */
  onMine: WatchProvider[];
};

const UNKNOWN_RUNTIME = 100_000;

const SORTS: { value: string; label: string; compare: (a: Entry, b: Entry) => number }[] = [
  { value: "added", label: "Recently added", compare: (a, b) => (b.addedAt?.getTime() ?? 0) - (a.addedAt?.getTime() ?? 0) },
  { value: "oldest", label: "Oldest added", compare: (a, b) => (a.addedAt?.getTime() ?? 0) - (b.addedAt?.getTime() ?? 0) },
  { value: "rating", label: "Highest rated", compare: (a, b) => (b.score ?? -1) - (a.score ?? -1) },
  { value: "shortest", label: "Shortest first", compare: (a, b) => (a.title.runtime ?? UNKNOWN_RUNTIME) - (b.title.runtime ?? UNKNOWN_RUNTIME) },
  { value: "longest", label: "Longest first", compare: (a, b) => (b.title.runtime ?? 0) - (a.title.runtime ?? 0) },
  { value: "newest", label: "Newest releases", compare: (a, b) => (b.title.year ?? 0) - (a.title.year ?? 0) },
  { value: "title", label: "Title (A–Z)", compare: (a, b) => a.title.title.localeCompare(b.title.title) },
];

/** "Oct 23" this year, "Oct 23, 2025" before that. */
const addedOn = (d: Date) => format(d, d.getFullYear() === new Date().getFullYear() ? "MMM d" : "MMM d, yyyy");

/** The line under each poster: whatever the list is sorted by, plus where you can stream it (first when filtering by it). */
function subtitleFor(e: Entry, sort: string, servicesFirst: boolean) {
  const sortBit =
    sort === "added" || sort === "oldest"
      ? e.addedAt && `Added ${addedOn(e.addedAt)}`
      : sort === "rating"
        ? e.scoreLabel
        : sort === "shortest" || sort === "longest"
          ? formatRuntime(e.title.runtime)
          : e.title.year;
  const services = e.onMine.map((p) => p.name).slice(0, 2).join(", ");
  return (servicesFirst ? [services, sortBit] : [sortBit, services]).filter(Boolean).join(" · ");
}

export async function WatchlistView({ profile, isOwn, base, searchParams }: ProfileViewProps) {
  const raw = await searchParams;
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) if (typeof value === "string" && value) params[key] = value;
  const type = params.type === "movie" || params.type === "tv" ? params.type : "all";
  const sort = SORTS.some((s) => s.value === params.sort) ? params.sort : "added";

  const viewer = isOwn ? profile : await getCurrentUser();
  const services = viewer?.streamingServices ?? [];
  const yours = expandServices(services);
  const onlyMine = params.where === "mine" && services.length > 0;

  const rows = await getWatchlistEntries(profile.id);
  const [imdb, providers] = await Promise.all([
    getSavedImdbScores(rows.map((r) => r.title.imdbId).filter((id): id is string => Boolean(id))),
    // Where each title streams, only needed once you've told us your services.
    services.length
      ? Promise.all(rows.map((r) => getStreamingProviders(r.title.mediaType, r.title.tmdbId).catch(() => [])))
      : rows.map(() => [] as WatchProvider[]),
  ]);
  const entries: Entry[] = rows.map((r, i) => {
    const fromImdb = r.title.imdbId ? imdb.get(r.title.imdbId) : undefined;
    const tmdb = r.title.voteAverage || null;
    return {
      ...r,
      score: fromImdb ?? tmdb,
      scoreLabel: fromImdb ? `IMDb ${fromImdb.toFixed(1)}` : tmdb ? `TMDB ${tmdb.toFixed(1)}` : null,
      // One entry per service (TMDB lists "Netflix" and "Netflix Standard with Ads" separately).
      onMine: providers[i].filter((p, j, all) => yours.has(p.id) && all.findIndex((q) => serviceKey(q.id) === serviceKey(p.id)) === j),
    };
  });

  const filtered = entries
    .filter((e) => type === "all" || e.title.mediaType === type)
    .filter((e) => !onlyMine || e.onMine.length > 0)
    .sort(SORTS.find((s) => s.value === sort)!.compare);

  const controls: FilterControl[] = [
    { name: "type", label: "Type", value: type, options: [{ value: "all", label: "Movies & TV" }, { value: "movie", label: "Movies" }, { value: "tv", label: "TV Shows" }] },
    { name: "sort", label: "Sort", value: sort, options: SORTS.map((s) => ({ value: s.value, label: s.label })) },
  ];
  if (services.length) {
    controls.push({
      name: "where",
      label: "Where",
      value: onlyMine ? "mine" : "",
      options: [
        { value: "", label: "Anywhere" },
        { value: "mine", label: "On my services" },
      ],
    });
  }
  const filtering = filtered.length !== entries.length;
  const picks: PickItem[] = filtered.map(({ title: t, scoreLabel, onMine }) => ({
    key: `${t.mediaType}-${t.tmdbId}`,
    tmdbId: t.tmdbId,
    mediaType: t.mediaType,
    title: t.title,
    year: t.year,
    posterPath: t.posterPath,
    backdropPath: t.backdropPath,
    overview: t.overview,
    runtime: t.runtime,
    genres: t.genres.map((g) => g.name),
    score: scoreLabel,
    services: onMine.map((p) => p.name),
  }));
  const pickedFrom = [onlyMine ? "on your services" : null, type === "movie" ? "(movies)" : type === "tv" ? "(TV)" : null].filter(Boolean).join(" ");

  return (
    <>
      <PageHeader
        title={isOwn ? "Your watchlist" : `${profile.displayName}'s watchlist`}
        subtitle={
          filtering ? (
            <>
              Showing {plural(filtered.length, "title")} of {entries.length.toLocaleString()} ·{" "}
              <Link href={`${base}/watchlist`} className="text-fg underline decoration-accent underline-offset-4">
                Clear filters
              </Link>
            </>
          ) : (
            plural(entries.length, "title")
          )
        }
      >
        {entries.length > 0 && <PickForMe items={picks} from={pickedFrom || "on this watchlist"} />}
      </PageHeader>
      {base && <ProfileTabs profile={profile} base={base} active="watchlist" />}
      {entries.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 pb-8 sm:px-8 lg:px-12">
          <FilterBar controls={controls} params={params} />
          {viewer && !services.length && (
            <Link href="/settings#services" className="text-sm text-muted underline decoration-accent underline-offset-4 hover:text-fg">
              Pick your streaming services to see what you can watch right now
            </Link>
          )}
        </div>
      )}
      {filtered.length === 0 ? (
        <EmptyState title={entries.length ? (onlyMine ? "Nothing here is on your services right now" : "Nothing matches those filters") : "Nothing on the watchlist"}>
          {entries.length ? "Try Anywhere, or another type." : isOwn && "Hit “Watchlist” on any movie or show to save it for later."}
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
              sizes="(min-width: 1280px) 12vw, (min-width: 768px) 18vw, 30vw"
              subtitle={subtitleFor(e, sort, onlyMine)}
              note={e.onMine.length ? `On ${e.onMine.map((p) => p.name).join(", ")}` : undefined}
            />
          ))}
        </div>
      )}
    </>
  );
}
