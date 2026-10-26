"use client";

import { Search, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { QuickSearchResult } from "@/app/api/search/route";
import { cn, MEDIA_LABEL, titleHref, tmdbImage } from "@/lib/format";

function isTypingTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
}

export function NavSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ term: string; data: QuickSearchResult } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const term = query.trim();

  // ⌘K / Ctrl+K or "/" opens search from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !isTypingTarget(e.target))) {
        e.preventDefault();
        setOpen(true);
        requestAnimationFrame(() => inputRef.current?.focus());
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);

  useEffect(() => {
    if (term.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: controller.signal });
        if (res.ok) setResults({ term, data: (await res.json()) as QuickSearchResult });
      } catch {
        // Aborted or offline; keep previous results.
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [term]);

  const close = () => {
    setOpen(false);
    setQuery("");
    setResults(null);
  };

  const showResults = open && term.length >= 2 && results !== null;
  const data = results?.data;

  return (
    <div ref={boxRef} className="relative">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          if (!term) return;
          router.push(`/search?q=${encodeURIComponent(term)}`);
          close();
        }}
        className={cn(
          "flex items-center gap-2 rounded border transition-all duration-200",
          open ? "w-[min(70vw,18rem)] border-fg/40 bg-black/80 px-2" : "w-8 border-transparent",
        )}
      >
        <button
          type="button"
          aria-label="Search"
          onClick={() => {
            setOpen(true);
            requestAnimationFrame(() => inputRef.current?.focus());
          }}
          className="grid size-8 shrink-0 place-items-center text-fg/90 hover:text-fg"
        >
          <Search className="size-5" />
        </button>
        {open && (
          <>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && close()}
              placeholder="Titles, people…"
              className="h-8 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-dim"
            />
            {query && (
              <button type="button" aria-label="Clear" onClick={() => setQuery("")} className="text-muted hover:text-fg">
                <X className="size-4" />
              </button>
            )}
          </>
        )}
      </form>

      {showResults && data && (
        <div className="absolute right-0 top-full mt-2 w-[min(92vw,26rem)] overflow-hidden rounded-lg border border-line bg-surface shadow-2xl shadow-black/60">
          {data.items.length === 0 && data.people.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted">Nothing found for “{results.term}”.</p>
          ) : (
            <ul className="max-h-[70vh] overflow-y-auto py-1">
              {data.items.map((item) => (
                <li key={`${item.mediaType}-${item.id}`}>
                  <Link
                    href={titleHref(item.mediaType, item.id)}
                    onClick={close}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-surface-3"
                  >
                    <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded bg-surface-3">
                      {item.posterPath && (
                        <Image src={tmdbImage(item.posterPath, "w92")!} alt="" fill sizes="40px" className="object-cover" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{item.title}</p>
                      <p className="text-xs text-muted">
                        {MEDIA_LABEL[item.mediaType]}
                        {item.year ? ` · ${item.year}` : ""}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
              {data.people.map((p) => (
                <li key={`person-${p.id}`}>
                  <Link href={`/person/${p.id}`} onClick={close} className="flex items-center gap-3 px-3 py-2 hover:bg-surface-3">
                    <div className="relative size-10 shrink-0 overflow-hidden rounded-full bg-surface-3">
                      {p.profilePath && (
                        <Image src={tmdbImage(p.profilePath, "w92")!} alt="" fill sizes="40px" className="object-cover" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{p.name}</p>
                      <p className="text-xs text-muted">{p.knownFor || "Person"}</p>
                    </div>
                  </Link>
                </li>
              ))}
              <li className="border-t border-line">
                <Link
                  href={`/search?q=${encodeURIComponent(results.term)}`}
                  onClick={close}
                  className="block px-3 py-2.5 text-sm text-muted hover:bg-surface-3 hover:text-fg"
                >
                  See all results for “{results.term}”
                </Link>
              </li>
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
