"use client";

import { useEffect, useRef, useState } from "react";
import type { TitlePreview } from "@/app/api/preview/route";
import { cn, formatRuntime, type MediaType, plural } from "@/lib/format";

// Shared across every card on the page, so each title is fetched once.
const cache = new Map<string, Promise<TitlePreview | null>>();

function loadPreview(mediaType: MediaType, id: number) {
  const key = `${mediaType}-${id}`;
  let pending = cache.get(key);
  if (!pending) {
    pending = fetch(`/api/preview?type=${mediaType}&id=${id}`)
      .then((res) => (res.ok ? (res.json() as Promise<TitlePreview>) : null))
      .catch(() => null);
    cache.set(key, pending);
  }
  return pending;
}

/**
 * The info panel that slides up when you hover a poster. Covers the whole poster so hovering
 * anywhere on it counts; details load after a short hover so scrolling past doesn't fetch everything.
 */
export function PreviewOverlay({
  mediaType,
  id,
  title,
  year,
  genres,
  note,
}: {
  mediaType: MediaType;
  id: number;
  title: string;
  year: number | null;
  /** Shown right away (if known) until the full details arrive. */
  genres?: string[];
  /** Extra line, e.g. "Watched 3×". */
  note?: string;
}) {
  const [preview, setPreview] = useState<TitlePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const start = () => {
    if (preview || timer.current) return;
    timer.current = setTimeout(() => {
      setLoading(true);
      void loadPreview(mediaType, id).then((p) => {
        setPreview(p);
        setLoading(false);
      });
    }, 150);
  };
  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => stop, []);

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
    <div className="absolute inset-0" onPointerEnter={start} onPointerLeave={stop} onFocus={start}>
      <div className="absolute inset-x-0 bottom-0 translate-y-2 bg-gradient-to-t from-black via-black/85 to-transparent p-3 pt-14 opacity-0 transition duration-300 group-hover/card:translate-y-0 group-hover/card:opacity-100 group-focus-visible/card:translate-y-0 group-focus-visible/card:opacity-100">
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
    </div>
  );
}
