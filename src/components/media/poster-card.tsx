import Image from "next/image";
import Link from "next/link";
import { cn, type MediaType, titleHref, tmdbImage } from "@/lib/format";
import { genreNames } from "@/lib/genres";
import { PosterFrame } from "./poster-frame";

export { MyRatingBadge } from "./rating-badge";

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
  const href = titleHref(item.mediaType, item.id);
  const src = tmdbImage(item.posterPath, "w342");
  return (
    <div className={cn("shrink-0 snap-start", className)} title={item.title}>
      <PosterFrame
        href={href}
        mediaType={item.mediaType}
        id={item.id}
        title={item.title}
        year={item.year}
        posterPath={item.posterPath}
        genres={posterGenres(item)}
        note={note}
        myRating={myRating}
        className="aspect-[2/3]"
      >
        {src ? (
          <Image src={src} alt={item.title} fill sizes={sizes} className="object-cover transition duration-500 group-hover/card:scale-105" />
        ) : (
          <span className="grid h-full place-items-center p-3 text-center text-sm text-muted">{item.title}</span>
        )}
      </PosterFrame>
      {subtitle && (
        <Link href={href} tabIndex={-1} className="mt-2 block truncate text-xs text-muted hover:text-fg">
          {subtitle}
        </Link>
      )}
    </div>
  );
}
