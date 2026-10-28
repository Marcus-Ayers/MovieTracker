"use client";

import { TriangleAlert } from "lucide-react";
import { useEffect } from "react";

/**
 * Shown in place of a page that crashed: a short message and a Try again button (Next.js renders this
 * automatically).
 */

export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const message = error instanceof Error ? error.message : "";
  return (
    <div className="mx-auto max-w-lg px-4 pb-10 pt-36 text-center">
      <div className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-surface-2 text-accent">
        <TriangleAlert className="size-6" />
      </div>
      <h1 className="mb-2 text-2xl font-bold">Something went wrong</h1>
      <p className="mb-6 text-muted">
        {message.includes("TMDB") ? "Couldn't reach TMDB. Check your connection and API key." : "This page hit an error."}
      </p>
      <button onClick={() => retry()} className="rounded bg-accent px-5 py-2.5 font-semibold text-white hover:bg-accent-hover">
        Try again
      </button>
    </div>
  );
}
