"use client";

import { Bookmark, BookmarkCheck, ChevronRight, Eye } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import type { MyTitle } from "@/app/api/my-title/route";
import type { TitlePreview } from "@/app/api/preview/route";
import { setWatchlist } from "@/lib/actions";
import { cn, formatRuntime, type MediaType, plural, tmdbImage } from "@/lib/format";
import { useIsTouch } from "@/lib/use-touch";
import { LogDialog } from "../log/log-button";
import { Modal } from "../ui/modal";
import { MyRatingBadge } from "./rating-badge";

// Title details are the same for everyone, so share them across every card on the page.
const previews = new Map<string, Promise<TitlePreview | null>>();

function loadPreview(mediaType: MediaType, id: number) {
  const key = `${mediaType}-${id}`;
  let pending = previews.get(key);
  if (!pending) {
    pending = fetch(`/api/preview?type=${mediaType}&id=${id}`)
      .then((res) => (res.ok ? (res.json() as Promise<TitlePreview>) : null))
      .catch(() => null);
    previews.set(key, pending);
  }
  return pending;
}

function loadMine(mediaType: MediaType, id: number): Promise<MyTitle | null> {
  return fetch(`/api/my-title?type=${mediaType}&id=${id}`)
    .then((res) => (res.ok ? (res.json() as Promise<MyTitle>) : null))
    .catch(() => null);
}

function ActionButton({ label, active, onClick, children }: { label: string; active?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "grid size-8 place-items-center rounded-full shadow-lg shadow-black/60 ring-1 backdrop-blur transition hover:scale-110",
        active ? "bg-fg text-bg ring-fg" : "bg-black/70 text-fg ring-white/30 hover:bg-black/90",
      )}
    >
      {children}
    </button>
  );
}

function Scores({ preview, loading }: { preview: TitlePreview | null; loading: boolean }) {
  if (loading && !preview) {
    return (
      <>
        <span className="h-4 w-14 animate-pulse rounded bg-white/15" />
        <span className="h-4 w-11 animate-pulse rounded bg-white/15" />
      </>
    );
  }
  const hasScores = Boolean(preview?.imdb || preview?.rottenTomatoes);
  return (
    <>
      {preview?.imdb && (
        <span className="inline-flex items-center gap-1 font-semibold">
          <span className="rounded-sm bg-gold px-1 text-[10px] font-black leading-4 text-black">IMDb</span>
          {preview.imdb}
        </span>
      )}
      {preview?.rottenTomatoes && (
        <span className={cn("inline-flex items-center gap-0.5 font-semibold", preview.imdb && "ml-1")}>
          <span aria-hidden>🍅</span>
          {preview.rottenTomatoes}
        </span>
      )}
      {preview && !hasScores && <span className="text-[11px] text-dim">No IMDb / RT scores</span>}
    </>
  );
}

/**
 * A poster that links to its title page. Hovering shows a details panel (length, genres, IMDb, Rotten Tomatoes)
 * and, when you're signed in, buttons to add it to your watchlist or log it. Phones can't hover, so there a tap
 * opens the same details and buttons in a sheet (like Netflix's app), with a link through to the title page.
 */
export function PosterFrame({
  href,
  mediaType,
  id,
  title,
  year,
  posterPath,
  genres,
  note,
  myRating,
  className,
  children,
}: {
  href: string;
  mediaType: MediaType;
  id: number;
  title: string;
  year: number | null;
  posterPath: string | null;
  /** Shown right away (if known) until full details arrive. */
  genres?: string[];
  /** Extra line in the panel, e.g. "Watched 3×". */
  note?: string;
  /** undefined = you haven't watched it; null = watched, unrated. */
  myRating?: number | null;
  className?: string;
  /** The poster image. */
  children: ReactNode;
}) {
  const [preview, setPreview] = useState<TitlePreview | null>(null);
  const [mine, setMine] = useState<MyTitle | null>(null);
  const [loading, setLoading] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const touch = useIsTouch();
  // Shows your rating right after logging, even where the page itself doesn't re-render (e.g. Movies grid).
  const [loggedRating, setLoggedRating] = useState<number | null | undefined>(undefined);
  const badgeRating = loggedRating !== undefined && myRating === undefined ? loggedRating : myRating;
  const [, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const started = useRef(false);

  const load = () => {
    if (started.current) return;
    started.current = true;
    setLoading(true);
    void Promise.all([loadPreview(mediaType, id), loadMine(mediaType, id)]).then(([p, m]) => {
      setPreview(p);
      setMine(m);
      setLoading(false);
    });
  };
  // Load details after a short hover, so scrolling past posters doesn't fetch everything.
  const start = () => {
    if (started.current || timer.current || touch) return;
    timer.current = setTimeout(load, 150);
  };
  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => stop, []);

  const signedIn = mine?.loggedIn ? mine : null;
  const toggleWatchlist = () => {
    if (!signedIn) return;
    const next = !signedIn.onWatchlist;
    setMine({ ...signedIn, onWatchlist: next });
    startTransition(() => setWatchlist(id, mediaType, next));
  };

  const shownGenres = (preview?.genres.length ? preview.genres : (genres ?? [])).slice(0, 3);
  const length = preview
    ? mediaType === "movie"
      ? formatRuntime(preview.runtime)
      : preview.seasons
        ? plural(preview.seasons, "season")
        : null
    : null;
  const details = [year, length].filter(Boolean).join(" · ");
  const sheetPoster = tmdbImage(posterPath, "w342");

  return (
    <div
      className={cn(
        "group/card relative overflow-hidden rounded-md bg-surface-2 ring-1 ring-white/5 transition duration-300 ease-out hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/70 hover:ring-white/25 focus-within:ring-2 focus-within:ring-fg",
        className,
      )}
      onPointerEnter={start}
      onPointerLeave={stop}
      onFocus={start}
    >
      <Link
        href={href}
        aria-label={title}
        onClick={(e) => {
          if (!touch) return;
          e.preventDefault();
          load();
          setSheetOpen(true);
        }}
        className="absolute inset-0 [-webkit-touch-callout:none] focus-visible:outline-none"
      >
        {children}
      </Link>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-2 bg-gradient-to-t from-black via-black/85 to-transparent p-3 pt-14 opacity-0 transition duration-300 group-focus-within/card:translate-y-0 group-focus-within/card:opacity-100 group-hover/card:translate-y-0 group-hover/card:opacity-100 [@media(hover:none)]:hidden">
        <p className="line-clamp-2 text-sm font-semibold leading-tight">{title}</p>
        <p className="mt-1 text-xs text-fg/80">{[year, length].filter(Boolean).join(" · ") || " "}</p>
        {shownGenres.length > 0 && <p className="mt-0.5 line-clamp-1 text-[11px] text-muted">{shownGenres.join(" · ")}</p>}
        <div className="mt-2 flex h-5 items-center gap-1.5 text-xs">
          <Scores preview={preview} loading={loading} />
        </div>
        {note && <p className="mt-1.5 text-[11px] font-medium text-gold">{note}</p>}
      </div>

      {signedIn && (
        <div className="absolute right-2 top-2 flex flex-col gap-1.5 opacity-0 transition group-focus-within/card:opacity-100 group-hover/card:opacity-100 [@media(hover:none)]:hidden">
          <ActionButton
            label={signedIn.onWatchlist ? "On your watchlist (click to remove)" : "Add to watchlist"}
            active={signedIn.onWatchlist}
            onClick={toggleWatchlist}
          >
            {signedIn.onWatchlist ? <BookmarkCheck className="size-4" /> : <Bookmark className="size-4" />}
          </ActionButton>
          <ActionButton label={badgeRating !== undefined ? "Log again" : "Log it"} onClick={() => setLogOpen(true)}>
            <Eye className="size-4" />
          </ActionButton>
        </div>
      )}

      {badgeRating !== undefined && <MyRatingBadge rating={badgeRating} className="pointer-events-none absolute left-2 top-2" />}

      {touch && (
        <Modal open={sheetOpen} onClose={() => setSheetOpen(false)} label={title}>
          <div className="flex gap-4 p-5 pr-14">
            <div className="relative aspect-[2/3] w-28 shrink-0 overflow-hidden rounded-lg bg-surface-3">
              {sheetPoster && <Image src={sheetPoster} alt="" fill sizes="112px" className="object-cover" />}
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-bold leading-tight">{title}</h2>
              {details && <p className="mt-1 text-sm text-muted">{details}</p>}
              {shownGenres.length > 0 && <p className="mt-0.5 text-sm text-dim">{shownGenres.join(" · ")}</p>}
              <div className="mt-3 flex h-5 items-center gap-1.5 text-sm">
                <Scores preview={preview} loading={loading} />
              </div>
              {badgeRating !== undefined && (
                <p className="mt-3 flex items-center gap-2 text-sm text-muted">
                  <MyRatingBadge rating={badgeRating} /> {badgeRating === null ? "You've watched this" : "Your rating"}
                </p>
              )}
              {note && <p className="mt-1.5 text-sm font-medium text-gold">{note}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 px-5 pb-5">
            {signedIn && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setSheetOpen(false);
                    setLogOpen(true);
                  }}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-accent font-semibold text-white"
                >
                  <Eye className="size-5" /> {badgeRating !== undefined ? "Log again" : "Log"}
                </button>
                <button
                  type="button"
                  onClick={toggleWatchlist}
                  className={cn(
                    "inline-flex h-12 items-center justify-center gap-2 rounded-lg font-semibold",
                    signedIn.onWatchlist ? "bg-fg text-bg" : "bg-surface-3 text-fg",
                  )}
                >
                  {signedIn.onWatchlist ? <BookmarkCheck className="size-5" /> : <Bookmark className="size-5" />}
                  {signedIn.onWatchlist ? "On watchlist" : "Watchlist"}
                </button>
              </>
            )}
            <Link
              href={href}
              onClick={() => setSheetOpen(false)}
              className="col-span-2 inline-flex h-12 items-center justify-center gap-1 rounded-lg border border-line font-semibold"
            >
              More details <ChevronRight className="size-5" />
            </Link>
          </div>
        </Modal>
      )}

      {signedIn && (
        <LogDialog
          open={logOpen}
          onClose={() => setLogOpen(false)}
          target={{ tmdbId: id, mediaType, title, year, posterPath, seasons: signedIn.seasons }}
          history={signedIn.history}
          onSaved={(rating) => {
            setLoggedRating(rating);
            // Logging takes a title off the watchlist; refresh what this card knows.
            void loadMine(mediaType, id).then((m) => m && setMine(m));
          }}
        />
      )}
    </div>
  );
}
