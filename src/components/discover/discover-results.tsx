"use client";

import { LayoutGrid, List } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import type { DiscoverItem } from "@/lib/discover";
import { loadMoreDiscover } from "@/lib/discover-actions";
import { cn, type MediaType } from "@/lib/format";
import { DiscoverCard, DiscoverListItem } from "./discover-card";

/**
 * Results for the Movies and TV pages as a poster grid or a list, with Load more (which asks the server for the
 * next page).
 */

export function DiscoverResults({
  media,
  query,
  view,
  initial,
  nextPage,
  totalResults,
  hideSeen,
}: {
  media: MediaType;
  query: string;
  view: "grid" | "list";
  initial: DiscoverItem[];
  nextPage: number | null;
  totalResults: number;
  hideSeen: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const [items, setItems] = useState(initial);
  const [next, setNext] = useState(nextPage);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(async () => {
    if (loading || next === null) return;
    setLoading(true);
    setError(false);
    try {
      const page = await loadMoreDiscover(media, query, next);
      setItems((prev) => {
        const seen = new Set(prev.map((i) => i.id));
        return [...prev, ...page.items.filter((i) => !seen.has(i.id))];
      });
      setNext(page.nextPage);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [loading, next, media, query]);

  // Infinite scroll: load the next page as the bottom comes into view.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || next === null || error) return;
    const observer = new IntersectionObserver((entries) => entries[0].isIntersecting && void loadMore(), { rootMargin: "800px" });
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore, next, error]);

  const setView = (v: "grid" | "list") => {
    const params = new URLSearchParams(query);
    if (v === "list") params.set("view", "list");
    else params.delete("view");
    const q = params.toString();
    startTransition(() => router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false }));
  };

  return (
    <div className="min-w-0 flex-1">
      <div className="mb-5 flex items-center justify-between gap-4">
        <p className="text-sm text-muted">
          {hideSeen ? "Unseen titles from " : ""}
          <span className="font-semibold text-fg">{totalResults.toLocaleString()}</span> results
        </p>
        <div className="flex rounded-lg border border-line p-0.5">
          {(
            [
              ["grid", LayoutGrid, "Grid"],
              ["list", List, "List with summaries"],
            ] as const
          ).map(([v, Icon, label]) => (
            <button
              key={v}
              type="button"
              title={label}
              aria-label={label}
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={cn("grid size-8 place-items-center rounded-md transition", view === v ? "bg-fg text-bg" : "text-muted hover:text-fg")}
            >
              <Icon className="size-4" />
            </button>
          ))}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line px-6 py-16 text-center">
          <p className="text-lg font-semibold">Nothing matches those filters</p>
          <p className="mt-2 text-sm text-muted">Try widening the years, lowering the minimum votes, or removing a genre.</p>
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          {items.map((item) => (
            <DiscoverCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {items.map((item) => (
            <DiscoverListItem key={item.id} item={item} />
          ))}
        </div>
      )}

      <div ref={sentinel} className="flex justify-center py-10">
        {next !== null && (
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loading}
            className="rounded-full border border-line px-6 py-2.5 text-sm font-medium hover:border-fg/40 disabled:opacity-60"
          >
            {loading ? "Loading…" : error ? "Couldn't load more — try again" : "Load more"}
          </button>
        )}
        {next === null && items.length > 0 && <p className="text-sm text-dim">That&apos;s everything.</p>}
      </div>
    </div>
  );
}
