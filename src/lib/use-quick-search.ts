"use client";

import { useEffect, useState } from "react";
import type { QuickSearchResult } from "@/app/api/search/route";

/**
 * Search-as-you-type against /api/search (TMDB titles + people). Waits for a 200ms pause in typing, cancels
 * requests that are out of date, and returns null until there are results for what's typed. While you keep
 * typing ("hea" → "heat"), the previous results stay up instead of flickering away.
 */
export function useQuickSearch(query: string): { term: string; data: QuickSearchResult } | null {
  const term = query.trim();
  const [found, setFound] = useState<{ term: string; data: QuickSearchResult } | null>(null);

  useEffect(() => {
    if (term.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: controller.signal })
        .then((res) => (res.ok ? (res.json() as Promise<QuickSearchResult>) : null))
        .then((data) => data && setFound({ term, data }))
        .catch(() => {
          // Cancelled (you kept typing) or offline: keep what's showing.
        });
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [term]);

  if (term.length < 2 || !found) return null;
  return found.term === term || term.startsWith(found.term) ? found : null;
}
