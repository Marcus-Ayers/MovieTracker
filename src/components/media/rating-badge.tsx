import { Check } from "lucide-react";
import { cn } from "@/lib/format";

/** Your rating badge. `rating` null = watched but unrated. */
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
