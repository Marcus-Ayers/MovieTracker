"use client";

import { BookOpen, EyeOff, PenLine, SkipForward, Undo2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useEffectEvent, useState, useTransition } from "react";
import type { PlotResponse } from "@/app/api/plot/route";
import { loadRateQueue, rateFromQueue, setSkipRating } from "@/lib/actions";
import { cn, formatDate, formatRuntime, plural, titleHref, tmdbImage } from "@/lib/format";
import type { RateItem } from "@/lib/rate-queue";
import { LogDialog } from "../log/log-button";
import { RATING_WORDS } from "../log/rating-picker";

// ---------------------------------------------------------------------------
// Plots: fetched once per title, and a couple of cards ahead so the next one is instant.
// ---------------------------------------------------------------------------

const plotUrl = (item: RateItem) =>
  `/api/plot?type=${item.mediaType}&id=${item.tmdbId}${item.seasonNumber !== null ? `&season=${item.seasonNumber}` : ""}`;

const plots = new Map<string, Promise<PlotResponse | null>>();

function fetchPlot(url: string) {
  let pending = plots.get(url);
  if (!pending) {
    pending = fetch(url)
      .then((res) => (res.ok ? (res.json() as Promise<PlotResponse>) : null))
      .catch(() => null);
    plots.set(url, pending);
  }
  return pending;
}

function usePlot(url: string) {
  const [loaded, setLoaded] = useState<{ url: string; data: PlotResponse | null } | null>(null);
  useEffect(() => {
    let live = true;
    fetchPlot(url).then((data) => {
      if (live) setLoaded({ url, data });
    });
    return () => {
      live = false;
    };
  }, [url]);
  return loaded?.url === url ? { loading: false, data: loaded.data } : { loading: true, data: null };
}

function preload(item: RateItem | undefined) {
  if (!item) return;
  void fetchPlot(plotUrl(item));
  const poster = tmdbImage(item.posterPath, "w500");
  if (poster) new window.Image().src = poster;
}

// ---------------------------------------------------------------------------
// One card
// ---------------------------------------------------------------------------

function PlotBox({ url, compact }: { url: string; compact: boolean }) {
  const { loading, data } = usePlot(url);
  if (!loading && !data?.plot) return null;
  return (
    <section className="mt-5 overflow-hidden rounded-lg border border-line bg-bg/60">
      <h3 className="flex items-center gap-2 border-b border-line px-4 py-2 text-xs font-semibold uppercase tracking-widest text-muted">
        <BookOpen className="size-3.5" /> What happens
        <span className="font-medium normal-case tracking-normal text-accent">· spoilers</span>
      </h3>
      <div className={cn("space-y-3 overflow-y-auto px-4 py-3 text-sm leading-relaxed text-fg/80", compact ? "max-h-44" : "max-h-72")}>
        {loading ? (
          <div className="space-y-2" aria-label="Loading the plot">
            {[100, 96, 88, 92, 60].map((w, i) => (
              <div key={i} className="h-3 animate-pulse rounded bg-surface-3" style={{ width: `${w}%` }} />
            ))}
          </div>
        ) : (
          data!.plot!.paragraphs.map((p, i) => <p key={i}>{p}</p>)
        )}
      </div>
      {data?.plot && (
        <p className="border-t border-line px-4 py-1.5 text-[11px] text-dim">
          From{" "}
          <a href={data.plot.url} target="_blank" rel="noreferrer" className="underline hover:text-fg">
            Wikipedia: {data.plot.article}
          </a>{" "}
          · CC BY-SA
        </p>
      )}
    </section>
  );
}

function RateCard({ item, compact }: { item: RateItem; compact: boolean }) {
  const poster = tmdbImage(item.posterPath, "w500");
  const { data } = usePlot(plotUrl(item));
  const watched = [
    item.lastWatched ? `Watched ${formatDate(item.lastWatched)}` : "Watched, date unknown",
    item.watchedWhere,
    item.watchCount > 1 ? `${item.watchCount}×` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const facts = [formatRuntime(item.runtime), ...item.genres.slice(0, 3)].filter(Boolean).join(" · ");

  return (
    <div className={cn("grid gap-5", compact ? "grid-cols-[96px_1fr] sm:grid-cols-[128px_1fr]" : "md:grid-cols-[240px_1fr] md:gap-10")}>
      <Link
        href={titleHref(item.mediaType, item.tmdbId)}
        className={cn(
          "relative aspect-[2/3] overflow-hidden rounded-lg bg-surface-2 shadow-2xl shadow-black",
          compact ? "w-full self-start" : "mx-auto w-40 sm:w-48 md:w-full md:self-start",
        )}
      >
        {poster && <Image src={poster} alt="" fill preload sizes={compact ? "128px" : "240px"} className="object-cover" />}
      </Link>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">{watched}</p>
        <h2 className={cn("mt-1 font-black leading-tight tracking-tight", compact ? "text-2xl" : "text-3xl sm:text-4xl")}>
          {item.title}
          {item.year && <span className={cn("ml-2 font-normal text-muted", compact ? "text-base" : "text-xl")}>{item.year}</span>}
        </h2>
        {item.seasonName && <p className="mt-0.5 font-semibold text-tv">{item.seasonName}</p>}
        {facts && <p className="mt-2 text-sm text-muted">{facts}</p>}
        {item.makers && (
          <p className="mt-1 text-sm text-muted">
            {item.makers.label} <span className="text-fg">{item.makers.names.join(", ")}</span>
          </p>
        )}
        {item.cast.length > 0 && (
          <p className="mt-0.5 text-sm text-muted">
            Starring <span className="text-fg">{item.cast.join(", ")}</span>
          </p>
        )}
        {(data?.seasonOverview ?? item.overview) && (
          <p className={cn("mt-4 leading-relaxed text-fg/85", compact && "line-clamp-4 text-sm")}>{data?.seasonOverview ?? item.overview}</p>
        )}
        <PlotBox url={plotUrl(item)} compact={compact} />
      </div>
    </div>
  );
}

function RatingButtons({ onRate, compact }: { onRate: (rating: number) => void; compact: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  return (
    <div>
      <p className="mb-2 h-5 text-sm text-muted">
        {hover ? (
          <>
            <span className="font-semibold text-gold">{hover}/10</span> · {RATING_WORDS[hover]}
          </>
        ) : (
          "How was it?"
        )}
      </p>
      <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-10" onMouseLeave={() => setHover(null)}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${n} out of 10`}
            onMouseEnter={() => setHover(n)}
            onFocus={() => setHover(n)}
            onClick={() => onRate(n)}
            className={cn(
              "rounded-md font-black tabular-nums transition active:scale-95",
              compact ? "h-11 text-base" : "h-14 text-lg",
              hover !== null && n <= hover ? "bg-gold text-black" : "bg-surface-3 text-muted hover:text-fg",
            )}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The queue
// ---------------------------------------------------------------------------

type Outcome = { kind: "rated"; rating: number } | { kind: "reviewed"; rating: number | null } | { kind: "skipped" } | { kind: "dismissed" };

function describe(item: RateItem, outcome: Outcome) {
  const name = item.seasonName ? `${item.title} (${item.seasonName})` : item.title;
  if (outcome.kind === "rated") return `Rated ${name} ${outcome.rating}/10`;
  if (outcome.kind === "reviewed") return `Saved your review of ${name}`;
  if (outcome.kind === "dismissed") return `Won't ask about ${name} again`;
  return `Skipped ${name} for now`;
}

/** Keys that shouldn't rate anything: typing in a field, or shortcuts with modifiers. */
function ignoreKey(e: KeyboardEvent) {
  const el = e.target as HTMLElement | null;
  return e.metaKey || e.ctrlKey || e.altKey || Boolean(el?.closest("input, textarea, select, [contenteditable='true']"));
}

/**
 * Rate everything you've watched, one card at a time. Ratings save in the background so the next card shows
 * immediately; Undo goes back one step (and takes the rating back off).
 */
export function RateQueue({
  initialItems,
  initialTotal,
  compact = false,
  onDone,
}: {
  initialItems: RateItem[];
  initialTotal: number;
  /** The smaller layout used in the pop-up. */
  compact?: boolean;
  /** Pop-up only: shows a Close button once everything's rated. */
  onDone?: () => void;
}) {
  const [items, setItems] = useState(initialItems);
  const [total, setTotal] = useState(initialTotal);
  const [index, setIndex] = useState(0);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [loadingMore, startLoading] = useTransition();
  const item = items[index] as RateItem | undefined;
  const last = index > 0 ? { item: items[index - 1], outcome: outcomes[index - 1] } : null;
  const ratedCount = outcomes.filter((o) => o.kind === "rated" || (o.kind === "reviewed" && o.rating !== null)).length;

  useEffect(() => {
    preload(items[index + 1]);
    preload(items[index + 2]);
  }, [items, index]);

  const save = (promise: Promise<unknown>) => {
    setError(null);
    promise.catch(() => setError("Couldn't save that. Check your connection, then use Undo and try again."));
  };
  const advance = (outcome: Outcome) => {
    setOutcomes((prev) => [...prev.slice(0, index), outcome]);
    setIndex(index + 1);
  };

  const rate = (rating: number) => {
    if (!item) return;
    save(rateFromQueue(item.viewingId, rating));
    advance({ kind: "rated", rating });
  };
  const skip = () => item && advance({ kind: "skipped" });
  const dismiss = () => {
    if (!item) return;
    save(setSkipRating(item.viewingIds, true));
    advance({ kind: "dismissed" });
  };
  const undo = () => {
    if (!last) return;
    const { item: prev, outcome } = last;
    if (outcome.kind === "rated" || (outcome.kind === "reviewed" && outcome.rating !== null)) save(rateFromQueue(prev.viewingId, null));
    if (outcome.kind === "dismissed") save(setSkipRating(prev.viewingIds, false));
    setOutcomes((prev) => prev.slice(0, index - 1));
    setIndex(index - 1);
  };
  const loadMore = () =>
    startLoading(async () => {
      const next = await loadRateQueue();
      setItems(next.items);
      setTotal(next.total);
      setIndex(0);
      setOutcomes([]);
    });

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (reviewing || ignoreKey(e)) return;
    if (/^[0-9]$/.test(e.key) && item) {
      e.preventDefault();
      rate(e.key === "0" ? 10 : Number(e.key));
    } else if ((e.key === "s" || e.key === "ArrowRight") && item) {
      e.preventDefault();
      skip();
    } else if (e.key === "z" || e.key === "ArrowLeft" || e.key === "Backspace") {
      e.preventDefault();
      undo();
    }
  });
  useEffect(() => {
    const listener = (e: KeyboardEvent) => onKey(e);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  const position = Math.min(index + 1, total);
  const status = (
    <div className="mb-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span className="tabular-nums text-muted">
          {item ? (
            <>
              <span className="font-semibold text-fg">{position.toLocaleString()}</span> of {total.toLocaleString()}
            </>
          ) : (
            `${plural(ratedCount, "rating")} this time`
          )}
        </span>
        {last && (
          <span className="flex min-w-0 items-center gap-2 text-dim">
            <span className="truncate">{describe(last.item, last.outcome)}</span>
            <button type="button" onClick={undo} className="inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-fg hover:bg-surface-3">
              <Undo2 className="size-3.5" /> Undo
            </button>
          </span>
        )}
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-3">
        <div className="h-full rounded-full bg-gold transition-all" style={{ width: `${total ? (index / total) * 100 : 100}%` }} />
      </div>
      {error && <p className="mt-2 text-sm text-accent">{error}</p>}
    </div>
  );

  if (!item) {
    const more = total > items.length;
    return (
      <div>
        {status}
        <div className="rounded-xl border border-line bg-surface px-6 py-12 text-center">
          <p className="text-2xl font-black">{more ? "Nice, that's a batch" : "All caught up"}</p>
          <p className="mt-2 text-muted">
            {more
              ? `${plural(total - index, "more title")} still need a rating.`
              : ratedCount
                ? `You rated ${plural(ratedCount, "title")}. Your library and stats are up to date.`
                : "Nothing left to rate."}
          </p>
          <div className="mt-6 flex justify-center gap-3">
            {more && (
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="rounded bg-accent px-5 py-2.5 font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
              >
                {loadingMore ? "Loading…" : "Keep going"}
              </button>
            )}
            {onDone ? (
              <button type="button" onClick={onDone} className="rounded border border-line px-5 py-2.5 font-semibold hover:border-fg/40">
                Close
              </button>
            ) : (
              <Link href="/library?sort=recent" className="rounded border border-line px-5 py-2.5 font-semibold hover:border-fg/40">
                Go to your library
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {status}
      <RateCard key={item.key} item={item} compact={compact} />
      <div className={cn(compact ? "mt-5" : "mt-8")}>
        <RatingButtons key={item.key} onRate={rate} compact={compact} />
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted">
          <button type="button" onClick={skip} className="inline-flex items-center gap-1.5 hover:text-fg">
            <SkipForward className="size-4" /> Not now
          </button>
          <button type="button" onClick={dismiss} className="inline-flex items-center gap-1.5 hover:text-fg">
            <EyeOff className="size-4" /> Don&apos;t ask about this
          </button>
          <button type="button" onClick={() => setReviewing(true)} className="inline-flex items-center gap-1.5 hover:text-fg">
            <PenLine className="size-4" /> Write a review
          </button>
          <span className="ml-auto hidden text-xs text-dim sm:inline">
            Keys: <kbd>1</kbd>–<kbd>9</kbd>, <kbd>0</kbd> = 10 · <kbd>S</kbd> skip · <kbd>Z</kbd> undo
          </span>
        </div>
      </div>
      <LogDialog
        open={reviewing}
        onClose={() => setReviewing(false)}
        target={{
          tmdbId: item.tmdbId,
          mediaType: item.mediaType,
          title: item.title,
          year: item.year,
          posterPath: item.posterPath,
          seasons: item.seasons,
        }}
        existing={item.draft}
        history={item.history}
        onSaved={(rating) => advance({ kind: "reviewed", rating })}
      />
    </div>
  );
}
