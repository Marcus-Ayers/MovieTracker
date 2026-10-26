import Image from "next/image";
import Link from "next/link";
import { titleHref, tmdbImage } from "@/lib/format";
import { MyRatingBadge, PosterCard, posterGenres, type PosterItem } from "./poster-card";
import { PreviewOverlay } from "./preview-overlay";
import { ScrollRow } from "./scroll-row";

export type WatchedMap = Record<string, number | null>;

export function myRatingFor(watched: WatchedMap | null, item: { mediaType: string; id: number }) {
  if (!watched) return undefined;
  const key = `${item.mediaType}-${item.id}`;
  return key in watched ? watched[key] : undefined;
}

export function PosterRow({
  title,
  items,
  watched,
  href,
}: {
  title: string;
  items: PosterItem[];
  watched: WatchedMap | null;
  href?: string;
}) {
  if (!items.length) return null;
  return (
    <ScrollRow title={title} href={href}>
      {items.map((item) => (
        <PosterCard
          key={`${item.mediaType}-${item.id}`}
          item={item}
          myRating={myRatingFor(watched, item)}
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
          <Link
            key={`${item.mediaType}-${item.id}`}
            href={titleHref(item.mediaType, item.id)}
            className="group/top relative flex shrink-0 snap-start items-end"
            title={item.title}
          >
            <span className="rank-numeral -mr-5 select-none text-[7.5rem] sm:-mr-7 sm:text-[10rem]" aria-hidden>
              {index + 1}
            </span>
            <div className="group/card relative aspect-[2/3] w-28 overflow-hidden rounded-md bg-surface-2 ring-1 ring-white/5 transition duration-300 group-hover/top:-translate-y-1 group-hover/top:ring-white/25 sm:w-36">
              {item.posterPath && (
                <Image src={tmdbImage(item.posterPath, "w342")!} alt={item.title} fill sizes="150px" className="object-cover" />
              )}
              <PreviewOverlay mediaType={item.mediaType} id={item.id} title={item.title} year={item.year} genres={posterGenres(item)} />
              {myRating !== undefined && <MyRatingBadge rating={myRating} className="absolute left-1.5 top-1.5" />}
            </div>
          </Link>
        );
      })}
    </ScrollRow>
  );
}

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
