import { cn } from "@/lib/format";

/** TMDB-style circular user score (0–100%). */
export function ScoreRing({ score, votes, className }: { score: number; votes: number; className?: string }) {
  const pct = Math.round(score * 10);
  const rated = votes > 0 && pct > 0;
  const color = !rated ? "#666672" : pct >= 70 ? "#21d07a" : pct >= 40 ? "#d2d531" : "#db2360";
  const r = 15;
  const c = 2 * Math.PI * r;
  return (
    <span
      className={cn("relative grid size-10 shrink-0 place-items-center rounded-full bg-[#081c22] ring-2 ring-[#081c22]", className)}
      title={rated ? `TMDB user score ${pct}% (${votes.toLocaleString()} votes)` : "Not rated yet"}
    >
      <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90">
        <circle cx="18" cy="18" r={r} fill="none" stroke={color} strokeOpacity={0.25} strokeWidth="3" />
        {rated && (
          <circle cx="18" cy="18" r={r} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeDasharray={`${(pct / 100) * c} ${c}`} />
        )}
      </svg>
      <span className="relative text-[11px] font-bold leading-none text-white">
        {rated ? (
          <>
            {pct}
            <sup className="text-[6px]">%</sup>
          </>
        ) : (
          "NR"
        )}
      </span>
    </span>
  );
}
