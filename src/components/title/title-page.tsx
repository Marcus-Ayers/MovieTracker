import { ExternalLink, Heart, Plus, Repeat, Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import type { Viewing } from "@/db/schema";
import { getCurrentUser, getProfileAccess } from "@/lib/auth";
import {
  cn,
  formatDate,
  formatMoney,
  formatRuntime,
  languageName,
  type MediaType,
  plural,
  seasonLabel,
  tmdbImage,
} from "@/lib/format";
import { getTitleState, type LibraryEntry } from "@/lib/library";
import {
  getCollection,
  getExternalRatings,
  getTitleDetails,
  hasTmdbKey,
  type Person,
  type TitleDetails,
} from "@/lib/tmdb";
import { DynamicMarker } from "../dynamic-marker";
import { LogButton, type LogHistory, type LogTarget, type ViewingDraft } from "../log/log-button";
import { MissingKey } from "../missing-key";
import { MyRatingBadge, PosterCard } from "../media/poster-card";
import { PosterRow } from "../media/rows";
import { ScrollRow } from "../media/scroll-row";
import { ReviewBody } from "./review-body";
import { DeleteViewingButton, MainReviewButton, PriorWatchCounter, WatchlistButton } from "./title-buttons";
import { TrailerButton, VideoStrip } from "./videos";

export function TitlePage({ mediaType, params }: { mediaType: MediaType; params: Promise<{ id: string }> }) {
  if (!hasTmdbKey())
    return (
      <>
        <MissingKey />
        <DynamicMarker />
      </>
    );
  return (
    <>
      <Suspense fallback={<TitleSkeleton />}>
        <TitleContent mediaType={mediaType} params={params} />
      </Suspense>
      <DynamicMarker />
    </>
  );
}

export async function loadTitle(mediaType: MediaType, idParam: string) {
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) notFound();
  try {
    return await getTitleDetails(mediaType, id);
  } catch (error) {
    if (error instanceof Error && error.message.includes("(404)")) notFound();
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Helpers shared by the personal sections
// ---------------------------------------------------------------------------

const toDraft = (v: Viewing): ViewingDraft => ({
  id: v.id,
  watchedOn: v.watchedOn,
  seasonNumber: v.seasonNumber,
  rating: v.rating,
  liked: v.liked,
  isRewatch: v.isRewatch,
  reviewHtml: v.reviewHtml,
  isMainReview: v.isMainReview,
  containsSpoilers: v.containsSpoilers,
  watchedWhere: v.watchedWhere,
  format: v.format,
  watchedWith: v.watchedWith,
  tags: v.tags,
});

function historyFor(entry: LibraryEntry | null): LogHistory {
  return {
    hasHistory: Boolean(entry && entry.watchCount > 0),
    loggedSeasons: entry?.viewings.map((v) => v.seasonNumber) ?? [],
    hasMainReview: Boolean(entry?.viewings.some((v) => v.isMainReview && v.reviewHtml)),
  };
}

function PeopleLinks({ people }: { people: Person[] }) {
  return (
    <>
      {people.map((p, i) => (
        <span key={p.id}>
          {i > 0 && ", "}
          <Link href={`/person/${p.id}`} className="text-fg hover:underline hover:decoration-accent hover:underline-offset-4">
            {p.name}
          </Link>
        </span>
      ))}
    </>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-4 text-lg font-semibold tracking-tight sm:text-xl">{children}</h2>;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

async function TitleContent({ mediaType, params }: { mediaType: MediaType; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await loadTitle(mediaType, id);
  const [ratings, collection] = await Promise.all([
    getExternalRatings(d.imdbId),
    d.collection ? getCollection(d.collection.id).catch(() => null) : null,
  ]);

  const target: LogTarget = {
    tmdbId: d.id,
    mediaType: d.mediaType,
    title: d.title,
    year: d.year,
    posterPath: d.posterPath,
    seasons: d.seasons.map((s) => ({ number: s.number, name: s.name })),
  };
  const backdrop = tmdbImage(d.backdropPath, "original");
  const poster = tmdbImage(d.posterPath, "w500");
  const runtime = formatRuntime(d.runtime);
  const credit = d.mediaType === "movie" ? d.directors : d.creators;

  return (
    <article>
      {/* Hero */}
      <div className="relative">
        <div className="absolute inset-x-0 top-0 h-[75vh] max-h-[820px] overflow-hidden">
          {backdrop && <Image src={backdrop} alt="" fill preload sizes="100vw" className="object-cover object-top opacity-70" />}
          <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/70 to-bg/10" />
          <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-bg via-bg/80 to-transparent" />
        </div>

        <div className="relative flex gap-8 px-4 pt-28 sm:px-8 sm:pt-[22vh] lg:gap-12 lg:px-12">
          {poster && (
            <div className="relative hidden aspect-[2/3] w-56 shrink-0 self-start overflow-hidden rounded-lg shadow-2xl shadow-black ring-1 ring-white/10 md:block lg:w-72">
              <Image src={poster} alt={d.title} fill sizes="288px" className="object-cover" />
            </div>
          )}

          <div className="min-w-0 max-w-3xl flex-1 pb-4">
            {d.logoPath ? (
              <div className="relative mb-5 h-24 max-w-md sm:h-32">
                <Image
                  src={tmdbImage(d.logoPath, "w500")!}
                  alt={d.title}
                  fill
                  sizes="450px"
                  className="object-contain object-left-bottom drop-shadow-[0_4px_24px_rgba(0,0,0,0.8)]"
                />
              </div>
            ) : (
              <h1 className="mb-3 text-4xl font-black leading-[0.95] tracking-tight sm:text-6xl">{d.title}</h1>
            )}
            {d.logoPath && <h1 className="sr-only">{d.title}</h1>}
            {d.originalTitle && <p className="mb-2 text-sm text-muted">{d.originalTitle}</p>}

            <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
              {d.year && <span className="font-medium">{d.year}</span>}
              {d.certification && <span className="rounded border border-fg/40 px-1.5 py-px text-xs font-semibold">{d.certification}</span>}
              {runtime && <span>{d.mediaType === "tv" ? `${runtime} episodes` : runtime}</span>}
              {d.mediaType === "tv" && d.numberOfSeasons && <span>{plural(d.numberOfSeasons, "season")}</span>}
              <span className="text-muted">{d.genres.map((g) => g.name).join(" · ")}</span>
            </div>

            <div className="mb-5 flex flex-wrap items-center gap-2">
              {d.voteAverage > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded bg-black/50 px-2.5 py-1 text-sm backdrop-blur">
                  <Star className="size-4 fill-gold text-gold" />
                  <span className="font-bold">{d.voteAverage.toFixed(1)}</span>
                  <span className="text-xs text-muted">TMDB · {d.voteCount.toLocaleString()} votes</span>
                </span>
              )}
              {ratings?.imdb && (
                <span className="inline-flex items-center gap-1.5 rounded bg-black/50 px-2.5 py-1 text-sm backdrop-blur">
                  <span className="rounded-sm bg-gold px-1 text-[11px] font-black text-black">IMDb</span>
                  <span className="font-bold">{ratings.imdb}</span>
                </span>
              )}
              {ratings?.rottenTomatoes && (
                <span className="rounded bg-black/50 px-2.5 py-1 text-sm backdrop-blur">
                  🍅 <span className="font-bold">{ratings.rottenTomatoes}</span>
                </span>
              )}
              {ratings?.metacritic && (
                <span className="rounded bg-black/50 px-2.5 py-1 text-sm backdrop-blur">
                  <span className="text-xs text-muted">Metacritic</span> <span className="font-bold">{ratings.metacritic.split("/")[0]}</span>
                </span>
              )}
            </div>

            {d.tagline && <p className="mb-3 text-lg italic text-fg/80">“{d.tagline}”</p>}
            <p className="mb-5 max-w-2xl leading-relaxed text-fg/85">{d.overview}</p>

            {credit.length > 0 && (
              <p className="mb-6 text-sm text-muted">
                {d.mediaType === "movie" ? "Directed by " : "Created by "}
                <PeopleLinks people={credit} />
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <Suspense fallback={<div className="h-11 w-56 animate-pulse rounded bg-white/10" />}>
                <TitleActions target={target} />
              </Suspense>
              {d.trailer && <TrailerButton trailer={d.trailer} />}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-12 space-y-14 px-4 sm:px-8 lg:px-12">
        <Suspense fallback={null}>
          <YourActivity target={target} />
        </Suspense>

        <div className="grid gap-14 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-14">
            {d.cast.length > 0 && <CastStrip details={d} />}
            {d.crew.length > 0 && (
              <section>
                <SectionTitle>Crew</SectionTitle>
                <dl className="grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
                  {d.mediaType === "movie" && d.directors.length > 0 && (
                    <div>
                      <dt className="text-muted">Director{d.directors.length > 1 ? "s" : ""}</dt>
                      <dd><PeopleLinks people={d.directors} /></dd>
                    </div>
                  )}
                  {d.writers.length > 0 && (
                    <div>
                      <dt className="text-muted">Writing</dt>
                      <dd><PeopleLinks people={d.writers.slice(0, 5)} /></dd>
                    </div>
                  )}
                  {d.crew.map((group) => (
                    <div key={group.job}>
                      <dt className="text-muted">{group.job}</dt>
                      <dd><PeopleLinks people={group.people.slice(0, 5)} /></dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}

            {d.mediaType === "tv" && d.seasons.length > 0 && (
              <section>
                <SectionTitle>Seasons</SectionTitle>
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 xl:grid-cols-6">
                  {d.seasons.map((s) => (
                    <div key={s.number}>
                      <div className="relative aspect-[2/3] overflow-hidden rounded-md bg-surface-2">
                        {(s.posterPath || d.posterPath) && (
                          <Image src={tmdbImage(s.posterPath ?? d.posterPath, "w342")!} alt="" fill sizes="160px" className="object-cover" />
                        )}
                      </div>
                      <p className="mt-2 truncate text-sm font-medium">{s.name}</p>
                      <p className="text-xs text-muted">
                        {s.airDate?.slice(0, 4) ?? "TBA"} · {plural(s.episodeCount, "ep")}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {collection && collection.parts.length > 1 && (
              <section>
                <SectionTitle>Part of the {collection.name}</SectionTitle>
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 xl:grid-cols-6">
                  {collection.parts.map((part) => (
                    <PosterCard
                      key={part.id}
                      item={part}
                      sizes="160px"
                      subtitle={part.year ? String(part.year) : "Upcoming"}
                      className={cn(part.id === d.id && "opacity-50")}
                    />
                  ))}
                </div>
              </section>
            )}

            {d.videos.length > 0 && (
              <section>
                <SectionTitle>Trailers & Videos</SectionTitle>
                <VideoStrip videos={d.videos} />
              </section>
            )}
          </div>

          <aside className="space-y-10">
            <WhereToWatch details={d} />
            <DetailsList details={d} />
            {d.keywords.length > 0 && (
              <section>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">Keywords</h3>
                <div className="flex flex-wrap gap-1.5">
                  {d.keywords.slice(0, 24).map((k) => (
                    <span key={k.id} className="rounded-full bg-surface-2 px-2.5 py-1 text-xs text-muted">
                      {k.name}
                    </span>
                  ))}
                </div>
              </section>
            )}
          </aside>
        </div>
      </div>

      {d.recommendations.length > 0 && (
        <div className="mt-14">
          <PosterRow title="More Like This" items={d.recommendations} watched={null} />
        </div>
      )}
    </article>
  );
}

function CastStrip({ details: d }: { details: TitleDetails }) {
  return (
    <div className="-mx-4 sm:-mx-8 lg:-mx-12">
      <ScrollRow title="Cast">
        {d.cast.map((c) => (
          <Link key={c.id} href={`/person/${c.id}`} className="group/cast w-28 shrink-0 snap-start sm:w-32">
            <div className="relative aspect-square overflow-hidden rounded-full bg-surface-2 ring-1 ring-white/5 transition group-hover/cast:ring-2 group-hover/cast:ring-fg/60">
              {c.profilePath ? (
                <Image src={tmdbImage(c.profilePath, "w185")!} alt={c.name} fill sizes="128px" className="object-cover" />
              ) : (
                <span className="grid h-full place-items-center text-2xl font-bold text-dim">{c.name.slice(0, 1)}</span>
              )}
            </div>
            <p className="mt-2 truncate text-center text-sm font-medium">{c.name}</p>
            {c.character && <p className="truncate text-center text-xs text-muted">{c.character}</p>}
            {c.episodeCount && <p className="text-center text-[11px] text-dim">{plural(c.episodeCount, "episode")}</p>}
          </Link>
        ))}
      </ScrollRow>
    </div>
  );
}

function WhereToWatch({ details: d }: { details: TitleDetails }) {
  const p = d.providers;
  const groups = p
    ? ([
        ["Stream", p.stream],
        ["Rent", p.rent],
        ["Buy", p.buy],
      ] as const).filter(([, list]) => list.length > 0)
    : [];
  return (
    <section>
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">Where to watch</h3>
      {groups.length === 0 ? (
        <p className="text-sm text-dim">Not streaming in the US right now.</p>
      ) : (
        <div className="space-y-4">
          {groups.map(([label, list]) => (
            <div key={label}>
              <p className="mb-2 text-xs text-dim">{label}</p>
              <div className="flex flex-wrap gap-2">
                {list.slice(0, 8).map((provider) => (
                  <a
                    key={provider.id}
                    href={p?.link ?? undefined}
                    target="_blank"
                    rel="noreferrer"
                    title={provider.name}
                    className="relative size-11 overflow-hidden rounded-lg ring-1 ring-white/10 transition hover:ring-fg/60"
                  >
                    <Image src={tmdbImage(provider.logoPath, "w92")!} alt={provider.name} fill sizes="44px" />
                  </a>
                ))}
              </div>
            </div>
          ))}
          <p className="text-[11px] text-dim">Availability by JustWatch</p>
        </div>
      )}
    </section>
  );
}

function DetailsList({ details: d }: { details: TitleDetails }) {
  const rows: [string, React.ReactNode][] = [];
  const add = (label: string, value: React.ReactNode) => value && rows.push([label, value]);
  add("Status", d.status);
  if (d.mediaType === "movie") add("Released", formatDate(d.releaseDate));
  else {
    add("First aired", formatDate(d.releaseDate));
    add("Last aired", formatDate(d.lastAirDate));
    add("Episodes", d.numberOfEpisodes?.toLocaleString());
    add("Network", d.networks.map((n) => n.name).join(", "));
  }
  add("Runtime", formatRuntime(d.runtime));
  add("Language", languageName(d.originalLanguage));
  add("Country", d.countries.slice(0, 3).join(", "));
  add("Budget", formatMoney(d.budget));
  add("Box office", formatMoney(d.revenue));
  add("Studios", d.companies.slice(0, 4).map((c) => c.name).join(", "));

  return (
    <section>
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">Details</h3>
      <dl className="divide-y divide-line/60 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 py-2">
            <dt className="shrink-0 text-muted">{label}</dt>
            <dd className="text-right">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 flex flex-wrap gap-3 text-xs">
        {d.imdbId && (
          <a href={`https://www.imdb.com/title/${d.imdbId}/`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-muted hover:text-fg">
            IMDb <ExternalLink className="size-3" />
          </a>
        )}
        <a href={`https://www.themoviedb.org/${d.mediaType}/${d.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-muted hover:text-fg">
          TMDB <ExternalLink className="size-3" />
        </a>
        {d.homepage && (
          <a href={d.homepage} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-muted hover:text-fg">
            Website <ExternalLink className="size-3" />
          </a>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Personal sections (stream in after the page shell)
// ---------------------------------------------------------------------------

async function TitleActions({ target }: { target: LogTarget }) {
  const user = await getCurrentUser();
  if (!user) return null;
  const state = await getTitleState(user.id, target.tmdbId, target.mediaType);
  return (
    <>
      <LogButton
        target={target}
        history={historyFor(state.entry)}
        className="inline-flex items-center gap-2 rounded bg-accent px-6 py-2.5 font-semibold text-white transition hover:bg-accent-hover"
      >
        <Plus className="size-5" strokeWidth={3} />
        {state.entry ? "Log again" : "Log"}
      </LogButton>
      <WatchlistButton tmdbId={target.tmdbId} mediaType={target.mediaType} onWatchlist={state.onWatchlist} />
      {state.entry && (
        <span className="flex items-center gap-2 text-sm text-muted">
          {state.entry.rating !== null && <MyRatingBadge rating={state.entry.rating} className="text-sm" />}
          {target.mediaType === "movie" ? `Watched ${plural(state.entry.watchCount, "time")}` : `${plural(state.entry.viewings.length, "entry", "entries")}`}
        </span>
      )}
    </>
  );
}

async function YourActivity({ target }: { target: LogTarget }) {
  const access = await getProfileAccess();
  if (access.status !== "ok") return null;
  const { owner, isOwner } = access;
  const state = await getTitleState(owner.id, target.tmdbId, target.mediaType);
  const entry = state.entry;

  // Visitors see the owner's take: rating + main review.
  if (!isOwner) {
    if (!entry) return null;
    return (
      <section className="max-w-3xl rounded-xl border border-line bg-surface p-6">
        <div className="mb-3 flex items-center gap-3">
          <h2 className="text-lg font-semibold">{owner.displayName}&apos;s take</h2>
          {entry.rating !== null && <MyRatingBadge rating={entry.rating} className="text-sm" />}
          {entry.liked && <Heart className="size-4 fill-accent text-accent" />}
        </div>
        {entry.mainReview?.reviewHtml ? (
          <ReviewBody html={entry.mainReview.reviewHtml} spoilers={entry.mainReview.containsSpoilers} />
        ) : (
          <p className="text-sm text-muted">Watched {plural(entry.watchCount, "time")}. No review yet.</p>
        )}
      </section>
    );
  }

  const history = historyFor(entry);
  const viewings = [...(entry?.viewings ?? [])].reverse();
  const isTv = target.mediaType === "tv";

  return (
    <section className="max-w-4xl">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight sm:text-xl">Your diary</h2>
          {entry && (
            <p className="text-sm text-muted">
              {isTv
                ? `${plural(entry.viewings.length, "entry", "entries")}${entry.rating !== null ? ` · show rating ${entry.rating}/10` : ""}`
                : `Watched ${plural(entry.watchCount, "time")}${entry.firstWatched ? ` · first logged ${formatDate(entry.firstWatched)}` : ""}`}
            </p>
          )}
        </div>
        {!isTv && <PriorWatchCounter tmdbId={target.tmdbId} mediaType={target.mediaType} count={state.priorWatchCount} />}
      </div>

      {isTv && entry && Object.keys(entry.seasonRatings).length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {Object.entries(entry.seasonRatings).map(([season, rating]) => (
            <span key={season} className="rounded-full bg-surface-2 px-3 py-1 text-xs">
              {seasonLabel(Number(season))} <span className="font-bold text-gold">{rating}</span>
            </span>
          ))}
        </div>
      )}

      {viewings.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-6 text-sm text-muted">
          You haven&apos;t logged this yet. Hit <span className="font-semibold text-fg">Log</span> above to add it to your diary.
        </p>
      ) : (
        <ol className="space-y-3">
          {viewings.map((v) => (
            <li key={v.id} className={cn("rounded-xl border bg-surface p-4 sm:p-5", v.isMainReview && v.reviewHtml ? "border-gold/40" : "border-line")}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="font-semibold">{formatDate(v.watchedOn) ?? "Date unknown"}</span>
                {isTv && <span className="rounded bg-surface-3 px-2 py-0.5 text-xs">{seasonLabel(v.seasonNumber)}</span>}
                {v.rating !== null && <span className="font-bold text-gold">{v.rating}/10</span>}
                {v.liked && <Heart className="size-4 fill-accent text-accent" aria-label="Liked" />}
                {v.isRewatch && <Repeat className="size-4 text-muted" aria-label="Rewatch" />}
                {v.isMainReview && v.reviewHtml && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-gold">
                    <Star className="size-3 fill-gold" /> Main review
                  </span>
                )}
                <span className="text-sm text-dim">{[v.watchedWhere, v.format, v.watchedWith && `with ${v.watchedWith}`].filter(Boolean).join(" · ")}</span>
                <span className="ml-auto flex items-center gap-4">
                  <LogButton target={target} existing={toDraft(v)} history={history} className="text-xs text-dim hover:text-fg">
                    Edit
                  </LogButton>
                  {v.reviewHtml && !v.isMainReview && <MainReviewButton viewingId={v.id} />}
                  <DeleteViewingButton viewingId={v.id} />
                </span>
              </div>
              {v.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {v.tags.map((t) => (
                    <span key={t} className="rounded-full bg-surface-3 px-2 py-0.5 text-[11px] text-muted">
                      #{t}
                    </span>
                  ))}
                </div>
              )}
              {v.reviewHtml && <ReviewBody html={v.reviewHtml} spoilers={v.containsSpoilers} className="mt-3" />}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function TitleSkeleton() {
  return (
    <div className="px-4 pt-28 sm:px-8 sm:pt-[22vh] lg:px-12">
      <div className="flex gap-10">
        <div className="hidden aspect-[2/3] w-72 animate-pulse rounded-lg bg-surface-2 md:block" />
        <div className="flex-1 space-y-4">
          <div className="h-14 w-2/3 animate-pulse rounded bg-surface-2" />
          <div className="h-4 w-1/3 animate-pulse rounded bg-surface-2" />
          <div className="h-24 w-full max-w-2xl animate-pulse rounded bg-surface-2" />
          <div className="h-11 w-64 animate-pulse rounded bg-surface-2" />
        </div>
      </div>
    </div>
  );
}
