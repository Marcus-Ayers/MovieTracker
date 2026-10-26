import Image from "next/image";
import Link from "next/link";
import type { DiscoverItem } from "@/lib/discover";
import { formatDate, titleHref, tmdbImage } from "@/lib/format";
import { genreNames } from "@/lib/genres";
import { PosterFrame } from "../media/poster-frame";
import { MyRatingBadge } from "../media/rating-badge";
import { ScoreRing } from "./score-ring";

/** Grid card: poster (with hover preview + watchlist/log buttons), score ring, title, date, genres. */
export function DiscoverCard({ item }: { item: DiscoverItem }) {
  const genres = genreNames(item.mediaType, item.genreIds);
  const href = titleHref(item.mediaType, item.id);
  return (
    <div title={item.title}>
      <PosterFrame
        href={href}
        mediaType={item.mediaType}
        id={item.id}
        title={item.title}
        year={item.year}
        posterPath={item.posterPath}
        genres={genres}
        myRating={item.myRating}
        className="aspect-[2/3] rounded-lg"
      >
        {item.posterPath && (
          <Image
            src={tmdbImage(item.posterPath, "w342")!}
            alt={item.title}
            fill
            sizes="(min-width: 1536px) 14vw, (min-width: 1280px) 16vw, (min-width: 768px) 22vw, 45vw"
            className="object-cover transition duration-500 group-hover/card:scale-105"
          />
        )}
      </PosterFrame>
      <Link href={href} tabIndex={-1} className="group/text relative block px-1 pt-6">
        <ScoreRing score={item.voteAverage} votes={item.voteCount} className="absolute -top-5 left-2" />
        <p className="line-clamp-2 text-sm font-semibold leading-snug group-hover/text:underline group-hover/text:decoration-accent group-hover/text:underline-offset-4">
          {item.title}
        </p>
        <p className="mt-0.5 text-xs text-muted">{formatDate(item.date) ?? "Date unknown"}</p>
        {genres.length > 0 && <p className="mt-0.5 truncate text-[11px] text-dim">{genres.slice(0, 3).join(" · ")}</p>}
      </Link>
    </div>
  );
}

/** List row: more to read at a glance — includes the plot summary. */
export function DiscoverListItem({ item }: { item: DiscoverItem }) {
  const genres = genreNames(item.mediaType, item.genreIds);
  return (
    <Link
      href={titleHref(item.mediaType, item.id)}
      className="group/row flex gap-4 rounded-xl border border-line bg-surface p-3 transition hover:border-fg/25 hover:bg-surface-2"
    >
      <div className="relative aspect-[2/3] w-20 shrink-0 overflow-hidden rounded-md bg-surface-3 sm:w-24">
        {item.posterPath && <Image src={tmdbImage(item.posterPath, "w185")!} alt="" fill sizes="96px" className="object-cover" />}
        {item.myRating !== undefined && <MyRatingBadge rating={item.myRating} className="absolute left-1 top-1" />}
      </div>
      <div className="min-w-0 flex-1 py-1">
        <div className="flex items-start gap-3">
          <ScoreRing score={item.voteAverage} votes={item.voteCount} className="mt-0.5" />
          <div className="min-w-0">
            <p className="font-semibold leading-snug group-hover/row:underline group-hover/row:decoration-accent group-hover/row:underline-offset-4">
              {item.title} {item.year && <span className="font-normal text-muted">({item.year})</span>}
            </p>
            <p className="text-xs text-muted">
              {[formatDate(item.date), genres.slice(0, 3).join(", ")].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-fg/75">{item.overview || "No overview yet."}</p>
      </div>
    </Link>
  );
}
