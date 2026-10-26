"use client";

import { Bookmark, BookmarkCheck, Eye } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import type { MyTitle } from "@/app/api/my-title/route";
import type { TitlePreview } from "@/app/api/preview/route";
import { setWatchlist } from "@/lib/actions";
import { cn, formatRuntime, type MediaType, plural } from "@/lib/format";
import { LogDialog } from "../log/log-button";
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

/**
 * A poster that links to its title page. Hovering shows a details panel (length, genres, IMDb, Rotten Tomatoes)
 * and, when you're signed in, buttons to add it to your watchlist or log it.
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
  // Shows your rating right after logging, even where the page itself doesn't re-render (e.g. Movies grid).
  const [loggedRating, setLoggedRating] = useState<number | null | undefined>(undefined);
  const badgeRating = loggedRating !== undefined && myRating === undefined ? loggedRating : myRating;
  const [, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const started = useRef(false);

  // Load details after a short hover, so scrolling past posters doesn't fetch everything.
  const start = () => {
    if (started.current || timer.current) return;
    timer.current = setTimeout(() => {
      started.current = true;
      setLoading(true);
      void Promise.all([loadPreview(mediaType, id), loadMine(mediaType, id)]).then(([p, m]) => {
        setPreview(p);
        setMine(m);
        setLoading(false);
      });
    }, 150);
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
  const hasScores = Boolean(preview?.imdb || preview?.rottenTomatoes);

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
      <Link href={href} aria-label={title} className="absolute inset-0 focus-visible:outline-none">
        {children}
      </Link>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-2 bg-gradient-to-t from-black via-black/85 to-transparent p-3 pt-14 opacity-0 transition duration-300 group-focus-within/card:translate-y-0 group-focus-within/card:opacity-100 group-hover/card:translate-y-0 group-hover/card:opacity-100">
        <p className="line-clamp-2 text-sm font-semibold leading-tight">{title}</p>
        <p className="mt-1 text-xs text-fg/80">{[year, length].filter(Boolean).join(" · ") || " "}</p>
        {shownGenres.length > 0 && <p className="mt-0.5 line-clamp-1 text-[11px] text-muted">{shownGenres.join(" · ")}</p>}
        <div className="mt-2 flex h-5 items-center gap-1.5 text-xs">
          {loading && !preview ? (
            <>
              <span className="h-4 w-14 animate-pulse rounded bg-white/15" />
              <span className="h-4 w-11 animate-pulse rounded bg-white/15" />
            </>
          ) : (
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
          )}
        </div>
        {note && <p className="mt-1.5 text-[11px] font-medium text-gold">{note}</p>}
      </div>

      {signedIn && (
        <div className="absolute right-2 top-2 flex flex-col gap-1.5 opacity-0 transition group-focus-within/card:opacity-100 group-hover/card:opacity-100">
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
