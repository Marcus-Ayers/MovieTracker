"use client";

import { Dices, Play } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { cn, formatRuntime, plural, titleHref, tmdbImage, type MediaType } from "@/lib/format";
import { Modal } from "../ui/modal";

export type PickItem = {
  key: string;
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  year: number | null;
  posterPath: string | null;
  backdropPath: string | null;
  overview: string | null;
  runtime: number | null;
  genres: string[];
  score: string | null;
  /** Your services it's streaming on. */
  services: string[];
};

/** Movie night: picks something at random from the watchlist as it's currently filtered. */
export function PickForMe({ items, from }: { items: PickItem[]; from: string }) {
  const [pick, setPick] = useState<PickItem | null>(null);
  const [open, setOpen] = useState(false);

  const roll = () => {
    // Never the same one twice in a row.
    const pool = pick && items.length > 1 ? items.filter((i) => i.key !== pick.key) : items;
    setPick(pool[Math.floor(Math.random() * pool.length)]);
    setOpen(true);
  };

  const backdrop = tmdbImage(pick?.backdropPath, "w1280");
  const poster = tmdbImage(pick?.posterPath, "w342");
  const facts = pick ? [pick.year, formatRuntime(pick.runtime), ...pick.genres.slice(0, 3)].filter(Boolean).join(" · ") : "";

  return (
    <>
      <button
        type="button"
        onClick={roll}
        disabled={!items.length}
        className="inline-flex items-center gap-2 rounded bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-hover disabled:opacity-40"
      >
        <Dices className="size-4" /> Pick one for me
      </button>
      <Modal open={open && pick !== null} onClose={() => setOpen(false)} label="Tonight's pick">
        {pick && (
          <div key={pick.key}>
            <div className="relative aspect-video w-full overflow-hidden rounded-t-xl bg-surface-2">
              {(backdrop ?? poster) && <Image src={(backdrop ?? poster)!} alt="" fill preload sizes="44rem" className={cn("object-cover", !backdrop && "blur-sm")} />}
              <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/30 to-transparent" />
              <p className="absolute left-5 top-4 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-accent backdrop-blur sm:left-7">
                Tonight&apos;s pick
              </p>
            </div>
            <div className="-mt-12 relative px-5 pb-6 sm:px-7">
              <h2 className="text-3xl font-black leading-tight tracking-tight">{pick.title}</h2>
              {facts && <p className="mt-1 text-sm text-muted">{facts}</p>}
              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                {pick.score && <span className="rounded bg-surface-3 px-2 py-0.5 font-semibold">{pick.score}</span>}
                {pick.services.map((s) => (
                  <span key={s} className="rounded bg-accent/15 px-2 py-0.5 text-accent">
                    On {s}
                  </span>
                ))}
              </div>
              {pick.overview && <p className="mt-4 line-clamp-4 leading-relaxed text-fg/85">{pick.overview}</p>}
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link
                  href={titleHref(pick.mediaType, pick.tmdbId)}
                  className="inline-flex items-center gap-2 rounded bg-fg px-5 py-2.5 font-semibold text-bg hover:bg-fg/85"
                >
                  <Play className="size-4 fill-bg" /> Let&apos;s watch it
                </Link>
                <button
                  type="button"
                  onClick={roll}
                  disabled={items.length < 2}
                  className="inline-flex items-center gap-2 rounded border border-line px-5 py-2.5 font-semibold hover:border-fg/40 disabled:opacity-40"
                >
                  <Dices className="size-4" /> Pick again
                </button>
                <span className="text-xs text-dim">
                  From {plural(items.length, "title")} {from}
                </span>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
