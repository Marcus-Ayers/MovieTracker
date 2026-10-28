import Image from "next/image";
import Link from "next/link";
import { titleHref, tmdbImage } from "@/lib/format";
import { PosterCard, posterGenres, type PosterItem } from "./poster-card";
import { PosterFrame } from "./poster-frame";
import { ScrollRow } from "./scroll-row";

export type WatchedMap = Record<string, number | null>;

/**
 * Your rating for a title from a watched map: a number, null if you've watched it without rating, or undefined if
 * you haven't watched it.
 */
export function myRatingFor(watched: WatchedMap | null, item: { mediaType: string; id: number }) {
  if (!watched) return undefined;
  const key = `${item.mediaType}-${item.id}`;
  return key in watched ? watched[key] : undefined;
}

/**
 * A titled, sideways-scrolling row of posters. `captions` puts a line under particular posters (e.g. "Alex ·
 * 9/10").
 */
export function PosterRow({
  title,
  subtitle,
  items,
  watched,
  href,
  captions,
}: {
  title: string;
  subtitle?: string;
  items: PosterItem[];
  watched: WatchedMap | null;
  href?: string;
  /** A line under particular posters, keyed "movie-949". */
  captions?: Record<string, string>;
}) {
  if (!items.length) return null;
  return (
    <ScrollRow title={title} subtitle={subtitle} href={href}>
      {items.map((item) => (
        <PosterCard
          key={`${item.mediaType}-${item.id}`}
          item={item}
          myRating={myRatingFor(watched, item)}
          subtitle={captions?.[`${item.mediaType}-${item.id}`]}
          className="w-[34vw] sm:w-40 lg:w-44 xl:w-48"
        />
      ))}
    </ScrollRow>
  );
}

/** Netflix's "Top 10" row: giant outlined rank numbers tucked behind each poster. */
export function Top10Row({ title, items, watched }: { title: string; items: PosterItem[]; watched: WatchedMap | null }) {
  if (!items.length) return null;
  return (
    <ScrollRow title={title}>
      {items.slice(0, 10).map((item, index) => {
        const myRating = myRatingFor(watched, item);
        return (
          <div key={`${item.mediaType}-${item.id}`} className="flex shrink-0 snap-start items-end" title={item.title}>
            <Link href={titleHref(item.mediaType, item.id)} tabIndex={-1} aria-hidden className="rank-numeral -mr-5 select-none text-[7.5rem] sm:-mr-7 sm:text-[10rem]">
              {index + 1}
            </Link>
            <PosterFrame
              href={titleHref(item.mediaType, item.id)}
              mediaType={item.mediaType}
              id={item.id}
              title={item.title}
              year={item.year}
              posterPath={item.posterPath}
              genres={posterGenres(item)}
              myRating={myRating}
              className="aspect-[2/3] w-28 sm:w-36"
            >
              {item.posterPath && (
                <Image src={tmdbImage(item.posterPath, "w342")!} alt={item.title} fill sizes="150px" className="object-cover" />
              )}
            </PosterFrame>
          </div>
        );
      })}
    </ScrollRow>
  );
}

/** Placeholder for a poster row while it loads. */
export function RowSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="px-4 sm:px-8 lg:px-12">
      <div className="mb-3 h-6 w-48 animate-pulse rounded bg-surface-2" />
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="aspect-[2/3] w-[34vw] shrink-0 animate-pulse rounded-md bg-surface-2 sm:w-40 lg:w-44 xl:w-48" />
        ))}
      </div>
    </div>
  );
}
