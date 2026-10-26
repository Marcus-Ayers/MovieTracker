"use client";

import { useState } from "react";
import { cn } from "@/lib/format";

export const RATING_WORDS: Record<number, string> = {
  1: "Awful",
  2: "Bad",
  3: "Poor",
  4: "Meh",
  5: "Okay",
  6: "Decent",
  7: "Good",
  8: "Great",
  9: "Amazing",
  10: "Masterpiece",
};

/** Whole-number 1–10 rating. Click the selected number again to clear it. */
export function RatingPicker({ name, defaultValue }: { name: string; defaultValue: number | null }) {
  const [value, setValue] = useState<number | null>(defaultValue);
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value;

  return (
    <div>
      <input type="hidden" name={name} value={value ?? ""} />
      <div className="flex gap-1" onMouseLeave={() => setHover(null)}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
          const filled = shown !== null && n <= shown;
          return (
            <button
              key={n}
              type="button"
              aria-label={`${n} out of 10`}
              aria-pressed={value === n}
              onMouseEnter={() => setHover(n)}
              onClick={() => setValue(value === n ? null : n)}
              className={cn(
                "h-10 flex-1 rounded text-sm font-bold transition",
                filled ? "bg-gold text-black" : "bg-surface-3 text-muted hover:bg-surface-2",
                value === n && "ring-2 ring-white/80 ring-offset-2 ring-offset-surface",
              )}
            >
              {n}
            </button>
          );
        })}
      </div>
      <p className="mt-2 h-5 text-sm text-muted">
        {shown !== null ? (
          <>
            <span className="font-semibold text-gold">{shown}/10</span> · {RATING_WORDS[shown]}
          </>
        ) : (
          "No rating"
        )}
      </p>
    </div>
  );
}
