import { Star } from "lucide-react";
import type { ExternalRatings } from "@/lib/ratings";
import { cn } from "@/lib/format";

const badge = "inline-flex items-center gap-1.5 rounded bg-black/50 px-2.5 py-1 text-sm backdrop-blur";

/** What everyone else gave it: TMDB, IMDb, Rotten Tomatoes and Metacritic, whichever are known. */
export function ScoreBadges({
  tmdb,
  votes,
  ratings,
  className,
}: {
  tmdb: number | null;
  votes?: number;
  ratings: ExternalRatings | null;
  className?: string;
}) {
  if (!tmdb && !ratings?.imdb && !ratings?.rottenTomatoes && !ratings?.metacritic) return null;
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {tmdb ? (
        <span className={badge}>
          <Star className="size-4 fill-gold text-gold" />
          <span className="font-bold">{tmdb.toFixed(1)}</span>
          <span className="text-xs text-muted">TMDB{votes ? ` · ${votes.toLocaleString()} votes` : ""}</span>
        </span>
      ) : null}
      {ratings?.imdb && (
        <span className={badge}>
          <span className="rounded-sm bg-gold px-1 text-[11px] font-black text-black">IMDb</span>
          <span className="font-bold">{ratings.imdb}</span>
        </span>
      )}
      {ratings?.rottenTomatoes && (
        <span className={badge}>
          🍅 <span className="font-bold">{ratings.rottenTomatoes}</span>
        </span>
      )}
      {ratings?.metacritic && (
        <span className={badge}>
          <span className="text-xs text-muted">Metacritic</span> <span className="font-bold">{ratings.metacritic.split("/")[0]}</span>
        </span>
      )}
    </div>
  );
}
