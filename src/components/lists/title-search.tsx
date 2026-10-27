"use client";

import { Plus, Search } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import type { QuickSearchResult } from "@/app/api/search/route";
import { cn, tmdbImage } from "@/lib/format";

export type SearchItem = QuickSearchResult["items"][number];

/** Type to search TMDB; picking a result hands it to `onPick` and clears the box. */
export function TitleSearch({ onPick, placeholder = "Add a movie or show…" }: { onPick: (item: SearchItem) => void; placeholder?: string }) {
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<{ query: string; items: SearchItem[] } | null>(null);
  const [focused, setFocused] = useState(false);
  const q = query.trim();
  const items = found && found.query === q ? found.items : [];

  useEffect(() => {
    if (q.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal })
        .then((res) => res.json() as Promise<QuickSearchResult>)
        .then((data) => setFound({ query: q, items: data.items }))
        .catch(() => {});
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q]);

  const pick = (item: SearchItem) => {
    onPick(item);
    setQuery("");
  };

  return (
    <div className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-dim" />
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && items[0]) {
            e.preventDefault();
            pick(items[0]);
          }
          if (e.key === "Escape") setQuery("");
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-10 w-full rounded-full border border-line bg-surface pl-9 pr-4 text-sm outline-none transition focus:border-fg/50"
      />
      {focused && items.length > 0 && (
        <ul className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-xl border border-line bg-surface-2 shadow-2xl shadow-black">
          {items.map((item) => (
            <li key={`${item.mediaType}-${item.id}`}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(item)}
                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-surface-3"
              >
                <span className="relative h-12 w-8 shrink-0 overflow-hidden rounded bg-surface-3">
                  {item.posterPath && <Image src={tmdbImage(item.posterPath, "w92")!} alt="" fill sizes="32px" className="object-cover" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{item.title}</span>
                  <span className="block text-xs text-dim">
                    {[item.year, item.mediaType === "tv" ? "TV" : "Movie"].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <Plus className={cn("size-4 text-muted")} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
