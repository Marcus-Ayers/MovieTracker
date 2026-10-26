import { Check } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { cn, type MediaType, titleHref, tmdbImage } from "@/lib/format";
import { genreNames } from "@/lib/genres";
import { PreviewOverlay } from "./preview-overlay";

export type PosterItem = {
  id: number;
  mediaType: MediaType;
  title: string;
  year: number | null;
  posterPath: string | null;
  voteAverage?: number | null;
  /** Genre names (library titles) or TMDB genre ids (browse lists); shown instantly in the hover preview. */
  genres?: string[];
  genreIds?: number[];
};

export function posterGenres(item: PosterItem) {
  return item.genres ?? (item.genreIds ? genreNames(item.mediaType, item.genreIds) : undefined);
}

/** Your rating badge. `rating` undefined = not watched; null = watched but unrated. */
export function MyRatingBadge({ rating, className }: { rating: number | null; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded bg-gold px-1.5 py-0.5 text-xs font-bold text-black shadow-md shadow-black/50",
        className,
      )}
      title={rating === null ? "Watched" : `You rated this ${rating}/10`}
    >
      {rating === null ? <Check className="size-3.5" strokeWidth={3} /> : rating}
    </span>
  );
}

export function PosterCard({
  item,
  myRating,
  sizes = "(min-width: 1024px) 200px, 40vw",
  className,
  subtitle,
  note,
}: {
  item: PosterItem;
  /** undefined = you haven't watched it */
  myRating?: number | null;
  sizes?: string;
  className?: string;
  subtitle?: string;
  /** Extra line in the hover preview, e.g. "Watched 3×". */
  note?: string;
}) {
  const src = tmdbImage(item.posterPath, "w342");
  return (
    <Link
      href={titleHref(item.mediaType, item.id)}
      className={cn("group/card relative block shrink-0 snap-start focus-visible:outline-none", className)}
      title={item.title}
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-md bg-surface-2 ring-1 ring-white/5 transition duration-300 ease-out group-hover/card:-translate-y-1 group-hover/card:shadow-2xl group-hover/card:shadow-black/70 group-hover/card:ring-white/25 group-focus-visible/card:ring-2 group-focus-visible/card:ring-fg">
        {src ? (
          <Image
            src={src}
            alt={item.title}
            fill
            sizes={sizes}
            className="object-cover transition duration-500 group-hover/card:scale-105"
          />
        ) : (
          <div className="grid h-full place-items-center p-3 text-center text-sm text-muted">{item.title}</div>
        )}
        <PreviewOverlay
          mediaType={item.mediaType}
          id={item.id}
          title={item.title}
          year={item.year}
          genres={posterGenres(item)}
          note={note}
        />
        {myRating !== undefined && <MyRatingBadge rating={myRating} className="absolute left-2 top-2" />}
      </div>
      {subtitle && <p className="mt-2 truncate text-xs text-muted">{subtitle}</p>}
    </Link>
  );
}
