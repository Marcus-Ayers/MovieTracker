"use client";

import { ChevronDown, Minus, Plus, SlidersHorizontal, X } from "lucide-react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type ReactNode } from "react";
import {
  CERTIFICATIONS,
  LANGUAGES,
  MONETIZATION,
  RUNTIME_MAX,
  SORTS,
  toQuery,
  VOTE_STEPS,
  type DiscoverFilters,
} from "@/lib/discover-filters";
import { cn, formatRuntime, tmdbImage } from "@/lib/format";
import { MOVIE_GENRES, TV_GENRES } from "@/lib/genres";
import { DualRange, StepSlider } from "./range-slider";

type Named = { id: number; name: string };
type Provider = { id: number; name: string; logoPath: string };

const DECADES = [1920, 1930, 1940, 1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020];

function Panel({ title, children, defaultOpen = true }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="group border-b border-line/70 py-4 last:border-0">
      <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold">
        {title}
        <ChevronDown className="size-4 text-muted transition group-open:rotate-180" />
      </summary>
      <div className="mt-3 space-y-3">{children}</div>
    </details>
  );
}

function Chip({ active, tone = "fg", onClick, children, title }: { active: boolean; tone?: "fg" | "include" | "exclude"; onClick: () => void; children: ReactNode; title?: string }) {
  return (
    <button
      type="button"
      title={title}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition",
        !active && "border-line text-muted hover:border-fg/30 hover:text-fg",
        active && tone === "fg" && "border-fg bg-fg text-bg",
        active && tone === "include" && "border-[#21d07a] bg-[#21d07a]/15 text-[#21d07a]",
        active && tone === "exclude" && "border-accent bg-accent/15 text-accent line-through",
      )}
    >
      {children}
    </button>
  );
}

/** Type-ahead for keywords / people. */
function Lookup({ type, placeholder, onPick }: { type: "keyword" | "person"; placeholder: string; onPick: (item: Named) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<(Named & { profilePath?: string | null; knownFor?: string })[]>([]);
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const controller = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/lookup?type=${type}&q=${encodeURIComponent(term)}`, { signal: controller.signal });
        if (res.ok) setResults(await res.json());
      } catch {
        // aborted
      }
    }, 200);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [q, type]);
  const open = q.trim().length >= 2 && results.length > 0;
  return (
    <div className="relative">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && setQ("")}
        placeholder={placeholder}
        className="h-9 w-full rounded-md border border-line bg-bg px-3 text-sm outline-none placeholder:text-dim focus:border-fg/40"
      />
      {open && (
        <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-md border border-line bg-surface shadow-xl shadow-black/60">
          {results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => {
                  onPick({ id: r.id, name: r.name });
                  setQ("");
                  setResults([]);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-3"
              >
                {type === "person" && (
                  <span className="relative size-7 shrink-0 overflow-hidden rounded-full bg-surface-3">
                    {r.profilePath && <Image src={tmdbImage(r.profilePath, "w92")!} alt="" fill sizes="28px" className="object-cover" />}
                  </span>
                )}
                <span className="truncate">{r.name}</span>
                {r.knownFor && <span className="ml-auto shrink-0 text-xs text-dim">{r.knownFor}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function YearInput({ value, placeholder, onCommit }: { value: number | null; placeholder: string; onCommit: (v: number | null) => void }) {
  const [text, setText] = useState(value ? String(value) : "");
  const [synced, setSynced] = useState(value);
  if (value !== synced) {
    setSynced(value);
    setText(value ? String(value) : "");
  }
  const commit = () => {
    const n = Number(text);
    const next = text.trim() === "" ? null : Number.isInteger(n) && n >= 1870 && n <= 2100 ? n : value;
    if (next !== value) onCommit(next);
    else setText(value ? String(value) : "");
  };
  return (
    <input
      inputMode="numeric"
      value={text}
      placeholder={placeholder}
      onChange={(e) => setText(e.target.value.replace(/\D/g, "").slice(0, 4))}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && commit()}
      className="h-9 w-full rounded-md border border-line bg-bg px-3 text-sm tabular-nums outline-none placeholder:text-dim focus:border-fg/40"
    />
  );
}

function FilterPanel({
  filters,
  providers,
  keywords,
  people,
  loggedIn,
  apply,
  reset,
}: {
  filters: DiscoverFilters;
  providers: Provider[];
  keywords: Named[];
  people: Named[];
  loggedIn: boolean;
  apply: (patch: Partial<DiscoverFilters>) => void;
  reset: () => void;
}) {
  const f = filters;
  const genres = Object.entries(f.media === "movie" ? MOVIE_GENRES : TV_GENRES)
    .map(([id, name]) => ({ id: Number(id), name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const [showAllProviders, setShowAllProviders] = useState(false);
  const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const cycleGenre = (id: number) => {
    if (f.genres.includes(id)) apply({ genres: f.genres.filter((g) => g !== id), excludeGenres: [...f.excludeGenres, id] });
    else if (f.excludeGenres.includes(id)) apply({ excludeGenres: f.excludeGenres.filter((g) => g !== id) });
    else apply({ genres: [...f.genres, id] });
  };

  return (
    <div>
      <div className="space-y-3 pb-4">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted">Sort by</span>
          <select
            value={f.sort}
            onChange={(e) => apply({ sort: e.target.value })}
            className="h-10 w-full cursor-pointer rounded-md border border-line bg-bg px-3 text-sm outline-none focus:border-fg/40"
          >
            {SORTS[f.media].map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        {loggedIn && (
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-line px-3 py-2.5 text-sm">
            Hide what I&apos;ve seen
            <input type="checkbox" checked={f.hideSeen} onChange={(e) => apply({ hideSeen: e.target.checked })} className="size-4 accent-accent" />
          </label>
        )}
      </div>

      <Panel title="Genres">
        <p className="text-[11px] text-dim">Click once to include, twice to exclude.</p>
        <div className="flex flex-wrap gap-1.5">
          {genres.map((g) => {
            const state = f.genres.includes(g.id) ? "include" : f.excludeGenres.includes(g.id) ? "exclude" : null;
            return (
              <Chip key={g.id} active={state !== null} tone={state ?? "fg"} onClick={() => cycleGenre(g.id)}>
                {state === "include" && <Plus className="size-3" />}
                {state === "exclude" && <Minus className="size-3" />}
                {g.name}
              </Chip>
            );
          })}
        </div>
      </Panel>

      <Panel title={f.media === "movie" ? "Release year" : "First aired"}>
        <div className="flex items-center gap-2">
          <YearInput value={f.from} placeholder="From" onCommit={(from) => apply({ from })} />
          <span className="text-dim">–</span>
          <YearInput value={f.to} placeholder="To" onCommit={(to) => apply({ to })} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {DECADES.map((d) => {
            const active = f.from === d && f.to === d + 9;
            return (
              <Chip key={d} active={active} onClick={() => apply(active ? { from: null, to: null } : { from: d, to: d + 9 })}>
                {String(d).slice(2)}s
              </Chip>
            );
          })}
        </div>
      </Panel>

      <Panel title="Score & votes">
        <DualRange
          min={0}
          max={10}
          step={0.5}
          value={[f.scoreMin, f.scoreMax]}
          format={(n) => `${n}`}
          onCommit={([scoreMin, scoreMax]) => apply({ scoreMin, scoreMax })}
        />
        <StepSlider steps={VOTE_STEPS} value={f.minVotes} onCommit={(minVotes) => apply({ minVotes })} />
      </Panel>

      <Panel title="Runtime">
        <DualRange
          min={0}
          max={RUNTIME_MAX}
          step={15}
          value={[f.runtimeMin, f.runtimeMax]}
          format={(n) => (n >= RUNTIME_MAX ? "Any" : n === 0 ? "0m" : formatRuntime(n)!)}
          onCommit={([runtimeMin, runtimeMax]) => apply({ runtimeMin, runtimeMax })}
        />
      </Panel>

      <Panel title="Where to watch" defaultOpen={f.providers.length > 0 || f.monetization.length > 0}>
        <div className="flex flex-wrap gap-1.5">
          {MONETIZATION.map((m) => (
            <Chip key={m.value} active={f.monetization.includes(m.value)} onClick={() => apply({ monetization: toggle(f.monetization, m.value) })}>
              {m.label}
            </Chip>
          ))}
        </div>
        <div className="grid grid-cols-6 gap-1.5">
          {(showAllProviders ? providers : providers.slice(0, 18)).map((p) => {
            const active = f.providers.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                title={p.name}
                aria-pressed={active}
                onClick={() => apply({ providers: toggle(f.providers, p.id) })}
                className={cn(
                  "relative aspect-square overflow-hidden rounded-md ring-2 transition",
                  active ? "ring-accent" : "opacity-60 ring-transparent hover:opacity-100",
                )}
              >
                <Image src={tmdbImage(p.logoPath, "w92")!} alt={p.name} fill sizes="40px" />
              </button>
            );
          })}
        </div>
        {providers.length > 18 && (
          <button type="button" onClick={() => setShowAllProviders((s) => !s)} className="text-xs text-muted hover:text-fg">
            {showAllProviders ? "Show fewer" : `Show all ${providers.length} services`}
          </button>
        )}
        <p className="text-[11px] text-dim">US availability by JustWatch</p>
      </Panel>

      <Panel title="More filters" defaultOpen={Boolean(f.language || f.certifications.length || f.keywords.length || f.people.length)}>
        {f.media === "movie" && (
          <div>
            <p className="mb-1.5 text-xs text-muted">Certification</p>
            <div className="flex flex-wrap gap-1.5">
              {CERTIFICATIONS.map((c) => (
                <Chip key={c} active={f.certifications.includes(c)} onClick={() => apply({ certifications: toggle(f.certifications, c) })}>
                  {c}
                </Chip>
              ))}
            </div>
          </div>
        )}
        <label className="block">
          <span className="mb-1.5 block text-xs text-muted">Original language</span>
          <select
            value={f.language}
            onChange={(e) => apply({ language: e.target.value })}
            className="h-9 w-full cursor-pointer rounded-md border border-line bg-bg px-3 text-sm outline-none focus:border-fg/40"
          >
            <option value="">Any language</option>
            {LANGUAGES.map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <div>
          <p className="mb-1.5 text-xs text-muted">Keywords (any of)</p>
          <Lookup type="keyword" placeholder="e.g. heist, time travel" onPick={(k) => apply({ keywords: [...new Set([...f.keywords, k.id])] })} />
          {keywords.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {keywords.map((k) => (
                <Chip key={k.id} active onClick={() => apply({ keywords: f.keywords.filter((id) => id !== k.id) })} title="Remove">
                  {k.name} <X className="size-3" />
                </Chip>
              ))}
            </div>
          )}
        </div>
        {f.media === "movie" && (
          <div>
            <p className="mb-1.5 text-xs text-muted">With people (cast or crew)</p>
            <Lookup type="person" placeholder="e.g. Christopher Nolan" onPick={(p) => apply({ people: [...new Set([...f.people, p.id])] })} />
            {people.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {people.map((p) => (
                  <Chip key={p.id} active onClick={() => apply({ people: f.people.filter((id) => id !== p.id) })} title="Remove">
                    {p.name} <X className="size-3" />
                  </Chip>
                ))}
              </div>
            )}
          </div>
        )}
      </Panel>

      <button type="button" onClick={reset} className="mt-2 text-sm text-muted underline-offset-4 hover:text-fg hover:underline">
        Reset all filters
      </button>
    </div>
  );
}

export function DiscoverSidebar(props: {
  filters: DiscoverFilters;
  providers: Provider[];
  keywords: Named[];
  people: Named[];
  loggedIn: boolean;
  activeCount: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [sheetOpen, setSheetOpen] = useState(false);

  const navigate = (query: string) =>
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  const apply = (patch: Partial<DiscoverFilters>) => navigate(toQuery({ ...props.filters, ...patch }));
  const reset = () => navigate(props.filters.view === "list" ? "view=list" : "");

  const panel = <FilterPanel {...props} apply={apply} reset={reset} />;

  return (
    <>
      <aside className={cn("hidden w-72 shrink-0 lg:block", pending && "opacity-70")}>
        <div className="no-scrollbar sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto rounded-xl border border-line bg-surface px-4 py-4">{panel}</div>
      </aside>

      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className="fixed bottom-[calc(var(--tabbar-h)+1rem)] left-1/2 z-30 inline-flex -translate-x-1/2 items-center gap-2 rounded-full bg-fg px-5 py-3 text-sm font-semibold text-bg shadow-2xl shadow-black lg:hidden"
      >
        <SlidersHorizontal className="size-4" /> Filters{props.activeCount > 0 && ` (${props.activeCount})`}
      </button>
      {sheetOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Close filters" className="absolute inset-0 bg-black/70" onClick={() => setSheetOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[85dvh] animate-sheet-up overflow-y-auto rounded-t-2xl border-t border-line bg-surface px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="font-semibold">Filters</p>
              <button type="button" onClick={() => setSheetOpen(false)} className="rounded-full bg-fg px-4 py-1.5 text-sm font-semibold text-bg">
                {pending ? "Loading…" : "Done"}
              </button>
            </div>
            {panel}
          </div>
        </div>
      )}
    </>
  );
}
