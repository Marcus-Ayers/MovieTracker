"use client";

import { RefreshCw } from "lucide-react";
import { useState, useTransition } from "react";
import { runRatingsUpdate } from "@/lib/actions";
import { cn } from "@/lib/format";

export type RatingsCardData = {
  imdbLine: string;
  rtLine: string;
  libraryLine: string;
  libraryPct: number;
  omdbUsed: number;
  omdbLimit: number;
  hasOmdbKey: boolean;
};

export function RatingsCard({ data }: { data: RatingsCardData }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <section className="rounded-xl border border-line bg-surface p-6">
      <h2 className="mb-1 font-semibold">Ratings data</h2>
      <p className="mb-5 text-sm text-muted">
        IMDb ratings come from IMDb&apos;s free daily file. Rotten Tomatoes scores come from OMDb and are saved permanently, so each movie is only looked up once.
        This updates automatically every night once the site is deployed.
      </p>
      <dl className="mb-5 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted">IMDb ratings</dt>
          <dd>{data.imdbLine}</dd>
        </div>
        <div>
          <dt className="text-muted">Rotten Tomatoes scores saved</dt>
          <dd>{data.rtLine}</dd>
        </div>
        <div>
          <dt className="text-muted">Your library</dt>
          <dd>{data.libraryLine}</dd>
          <div className="mt-1.5 h-1.5 max-w-60 overflow-hidden rounded-full bg-surface-3">
            <div className="h-full rounded-full bg-gold" style={{ width: `${data.libraryPct}%` }} />
          </div>
        </div>
        <div>
          <dt className="text-muted">OMDb lookups today</dt>
          <dd className={cn(data.omdbUsed >= data.omdbLimit && "text-accent")}>
            {data.hasOmdbKey ? `${data.omdbUsed.toLocaleString()} of ${data.omdbLimit.toLocaleString()}` : "No OMDb key set"}
          </dd>
        </div>
      </dl>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setMessage(null);
            const result = await runRatingsUpdate();
            setMessage(result.message);
          })
        }
        className="inline-flex items-center gap-2 rounded border border-line px-4 py-2 text-sm hover:border-fg/40 disabled:opacity-60"
      >
        <RefreshCw className={cn("size-4", pending && "animate-spin")} />
        {pending ? "Updating… this can take a minute" : "Update now"}
      </button>
      {message && <p className="mt-3 text-sm text-muted">{message}</p>}
    </section>
  );
}
