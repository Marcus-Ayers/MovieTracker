"use client";

import { Check, Minus, Plus, Star, Trash2 } from "lucide-react";
import { useOptimistic, useTransition } from "react";
import { adjustPriorWatchCount, deleteViewing, setMainReview, toggleWatchlist } from "@/lib/actions";
import { cn, type MediaType } from "@/lib/format";

export function WatchlistButton({ tmdbId, mediaType, onWatchlist }: { tmdbId: number; mediaType: MediaType; onWatchlist: boolean }) {
  const [optimistic, setOptimistic] = useOptimistic(onWatchlist);
  const [, startTransition] = useTransition();
  return (
    <button
      type="button"
      onClick={() =>
        startTransition(async () => {
          setOptimistic(!optimistic);
          await toggleWatchlist(tmdbId, mediaType);
        })
      }
      className={cn(
        "inline-flex items-center gap-2 rounded px-5 py-2.5 font-semibold backdrop-blur transition",
        optimistic ? "bg-white/90 text-black hover:bg-white" : "bg-white/15 hover:bg-white/25",
      )}
    >
      {optimistic ? <Check className="size-5" /> : <Plus className="size-5" />}
      Watchlist
    </button>
  );
}

export function PriorWatchCounter({ tmdbId, mediaType, count }: { tmdbId: number; mediaType: MediaType; count: number }) {
  const [optimistic, setOptimistic] = useOptimistic(count);
  const [, startTransition] = useTransition();
  const change = (delta: number) =>
    startTransition(async () => {
      setOptimistic(Math.max(0, optimistic + delta));
      await adjustPriorWatchCount(tmdbId, mediaType, delta);
    });
  return (
    <div className="flex items-center gap-3 text-sm text-muted">
      <span>Times seen before you started logging</span>
      <div className="flex items-center overflow-hidden rounded border border-line">
        <button type="button" aria-label="Decrease" onClick={() => change(-1)} disabled={optimistic === 0} className="grid size-7 place-items-center hover:bg-surface-3 disabled:opacity-30">
          <Minus className="size-3.5" />
        </button>
        <span className="w-8 text-center font-semibold tabular-nums text-fg">{optimistic}</span>
        <button type="button" aria-label="Increase" onClick={() => change(1)} className="grid size-7 place-items-center hover:bg-surface-3">
          <Plus className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

export function DeleteViewingButton({ viewingId }: { viewingId: number }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (window.confirm("Delete this diary entry? This can't be undone.")) startTransition(() => deleteViewing(viewingId));
      }}
      className="inline-flex items-center gap-1.5 text-xs text-dim hover:text-accent disabled:opacity-50"
    >
      <Trash2 className="size-3.5" /> Delete
    </button>
  );
}

export function MainReviewButton({ viewingId }: { viewingId: number }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => setMainReview(viewingId))}
      className="inline-flex items-center gap-1.5 text-xs text-dim hover:text-gold disabled:opacity-50"
    >
      <Star className="size-3.5" /> Make main review
    </button>
  );
}
