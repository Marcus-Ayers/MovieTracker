"use client";

import { Info, Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { cn, MEDIA_LABEL, type MediaType, titleHref, tmdbImage } from "@/lib/format";
import { MyRatingBadge } from "./poster-card";

export type HeroItem = {
  id: number;
  mediaType: MediaType;
  title: string;
  year: number | null;
  overview: string;
  backdropPath: string;
  logoPath: string | null;
  voteAverage: number;
  genres: string[];
  myRating?: number | null;
};

const ROTATE_MS = 9000;

/** Big billboard at the top of browse pages. Static artwork that rotates — never autoplaying video. */
export function Hero({ items }: { items: HeroItem[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || items.length < 2) return;
    const timer = setTimeout(() => setIndex((i) => (i + 1) % items.length), ROTATE_MS);
    return () => clearTimeout(timer);
  }, [index, paused, items.length]);

  if (!items.length) return <div className="h-24" />;
  const current = items[index];

  return (
    <section
      className="relative h-[78vh] min-h-[480px] w-full overflow-hidden sm:h-[88vh] sm:max-h-[900px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {items.map((item, i) => (
        <Image
          key={`${item.mediaType}-${item.id}`}
          src={tmdbImage(item.backdropPath, "original")!}
          alt=""
          fill
          preload={i === 0}
          sizes="100vw"
          className={cn(
            "object-cover object-[center_20%] transition-opacity duration-1000",
            i === index ? "opacity-100" : "opacity-0",
          )}
        />
      ))}
      <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/60 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-bg via-bg/70 to-transparent" />

      <div key={index} className="absolute inset-x-0 bottom-[14%] animate-fade-up px-4 sm:px-8 lg:px-12">
        <div className="max-w-xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-accent">
            Trending · {MEDIA_LABEL[current.mediaType]}
          </p>
          {current.logoPath ? (
            <div className="relative mb-5 h-24 w-full max-w-md sm:h-32">
              <Image
                src={tmdbImage(current.logoPath, "w500")!}
                alt={current.title}
                fill
                sizes="450px"
                className="object-contain object-left-bottom drop-shadow-[0_4px_24px_rgba(0,0,0,0.8)]"
              />
            </div>
          ) : (
            <h1 className="mb-4 text-4xl font-black leading-none tracking-tight sm:text-6xl">{current.title}</h1>
          )}
          <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-fg/90">
            {current.voteAverage > 0 && (
              <span className="flex items-center gap-1 font-semibold">
                <Star className="size-4 fill-gold text-gold" />
                {current.voteAverage.toFixed(1)}
              </span>
            )}
            {current.year && <span>{current.year}</span>}
            {current.genres.slice(0, 3).map((g) => (
              <span key={g} className="text-muted">
                {g}
              </span>
            ))}
            {current.myRating !== undefined && <MyRatingBadge rating={current.myRating} />}
          </div>
          <p className="mb-6 line-clamp-3 text-sm leading-relaxed text-fg/85 sm:text-base">{current.overview}</p>
          <Link
            href={titleHref(current.mediaType, current.id)}
            className="inline-flex items-center gap-2 rounded bg-white px-6 py-2.5 font-semibold text-black transition hover:bg-white/80"
          >
            <Info className="size-5" />
            More info
          </Link>
        </div>
      </div>

      {items.length > 1 && (
        <div className="absolute bottom-[6%] right-4 flex gap-1.5 sm:right-8 lg:right-12">
          {items.map((item, i) => (
            <button
              key={`${item.mediaType}-${item.id}`}
              type="button"
              aria-label={`Show ${item.title}`}
              onClick={() => setIndex(i)}
              className={cn("h-1 rounded-full transition-all", i === index ? "w-8 bg-fg" : "w-4 bg-fg/30 hover:bg-fg/60")}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/** Placeholder for the hero carousel while it loads. */
export function HeroSkeleton() {
  return <div className="h-[78vh] min-h-[480px] w-full animate-pulse bg-surface sm:h-[88vh] sm:max-h-[900px]" />;
}
