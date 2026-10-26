"use client";

import { Check, FileText, Heart, Repeat, Search, Upload } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import type { QuickSearchResult } from "@/app/api/search/route";
import {
  checkImportStatus,
  commitImport,
  finishImport,
  matchFilms,
  type CommitResult,
  type ImportMatch,
  type ImportStatus,
  type MatchConfidence,
} from "@/lib/import-actions";
import { parseImportFiles, pickDateFills, type ImportRow, type ParseResult } from "@/lib/import-parse";
import { getPlexImportRows } from "@/lib/plex-actions";
import { cn, formatDate, seasonLabel, titleHref, tmdbImage } from "@/lib/format";

type Entry = ImportRow & { match: ImportMatch | null; confidence: MatchConfidence; status: ImportStatus; include: boolean };
type Stage =
  | { name: "pick"; error?: string }
  | { name: "working"; label: string; done: number; total: number }
  | { name: "review" }
  | { name: "importing"; done: number; total: number }
  | { name: "done"; result: CommitResult };
type Filter = "all" | "check" | "missing" | "skipped";

const STATUS_LABEL: Record<ImportStatus, string> = {
  new: "New",
  imported: "Already imported",
  "same-day": "Already logged that day",
  "in-library": "Already in your library",
  conflict: "In your Letterboxd import",
  "fills-date": "Adds a date to your existing entry",
};

/** Statuses that get imported (everything else is skipped by default). */
const isActive = (status: ImportStatus) => status === "new" || status === "fills-date";

const SOURCE_CHIP: Record<ImportRow["source"], { label: string; className: string }> = {
  letterboxd: { label: "Letterboxd", className: "bg-[#00e054]/15 text-[#00e054]" },
  tmdb: { label: "TMDB", className: "bg-[#01b4e4]/15 text-[#01b4e4]" },
  plex: { label: "Plex", className: "bg-[#e5a00d]/15 text-[#e5a00d]" },
};

const chunk = <T,>(items: T[], size: number) =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, i * size + size));

const filmKey = (title: string, year: number | null) => `${title.toLowerCase().trim()}|${year ?? ""}`;

function Progress({ label, done, total }: { label: string; done: number; total: number }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="max-w-xl rounded-xl border border-line bg-surface p-6">
      <p className="mb-3 font-medium">{label}</p>
      <div className="h-2 overflow-hidden rounded-full bg-surface-3">
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-sm tabular-nums text-muted">
        {done.toLocaleString()} of {total.toLocaleString()}
      </p>
    </div>
  );
}

function FixMatch({ initial, onPick, onCancel }: { initial: string; onPick: (m: ImportMatch) => void; onCancel: () => void }) {
  const [query, setQuery] = useState(initial);
  const [results, setResults] = useState<QuickSearchResult["items"] | null>(null);
  const search = async () => {
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    if (res.ok) setResults(((await res.json()) as QuickSearchResult).items.filter((i) => i.mediaType === "movie"));
  };
  return (
    <div className="mt-3 rounded-lg border border-line bg-bg p-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
        className="flex gap-2"
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
          className="h-9 min-w-0 flex-1 rounded border border-line bg-surface px-3 text-sm outline-none focus:border-fg/40"
        />
        <button className="inline-flex items-center gap-1.5 rounded bg-surface-3 px-3 text-sm hover:bg-surface-2">
          <Search className="size-4" /> Search
        </button>
        <button type="button" onClick={onCancel} className="px-2 text-sm text-muted hover:text-fg">
          Cancel
        </button>
      </form>
      {results && (
        <ul className="mt-2 max-h-64 overflow-y-auto">
          {results.length === 0 && <li className="p-2 text-sm text-muted">No movies found.</li>}
          {results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => onPick({ tmdbId: r.id, title: r.title, year: r.year, posterPath: r.posterPath })}
                className="flex w-full items-center gap-3 rounded p-2 text-left hover:bg-surface-3"
              >
                <span className="relative h-12 w-8 shrink-0 overflow-hidden rounded bg-surface-3">
                  {r.posterPath && <Image src={tmdbImage(r.posterPath, "w92")!} alt="" fill sizes="32px" className="object-cover" />}
                </span>
                <span className="text-sm">
                  {r.title} <span className="text-muted">{r.year}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EntryRow({ entry, onChange }: { entry: Entry; onChange: (patch: Partial<Entry>) => void }) {
  const [fixing, setFixing] = useState(false);
  const m = entry.match;
  const differs = m && (m.title.toLowerCase() !== entry.title.toLowerCase() || (entry.year !== null && m.year !== entry.year));
  const skipped = !isActive(entry.status);

  return (
    <li className={cn("border-b border-line/60 px-3 py-3 last:border-0", !entry.include && "opacity-55")}>
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={entry.include}
          disabled={!m}
          onChange={(e) => onChange({ include: e.target.checked })}
          className="size-4 shrink-0 accent-accent"
          aria-label={`Import ${entry.title}`}
        />
        <span className="relative h-[54px] w-9 shrink-0 overflow-hidden rounded bg-surface-3">
          {m?.posterPath && <Image src={tmdbImage(m.posterPath, "w92")!} alt="" fill sizes="36px" className="object-cover" />}
        </span>
        <div className="min-w-0 flex-1">
          {m ? (
            <Link href={titleHref(entry.mediaType, m.tmdbId)} target="_blank" className="font-medium hover:underline">
              {m.title} <span className="font-normal text-muted">{m.year}</span>
            </Link>
          ) : (
            <span className="font-medium text-accent">No match found</span>
          )}
          {(differs || !m) && (
            <p className="truncate text-xs text-dim">
              In your file: {entry.title} {entry.year && `(${entry.year})`}
            </p>
          )}
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
            <span className={cn("rounded px-1.5 py-px font-medium", SOURCE_CHIP[entry.source].className)}>
              {SOURCE_CHIP[entry.source].label}
              {entry.mediaType === "tv" && " · TV"}
            </span>
            {entry.mediaType === "tv" && entry.seasonNumber !== null && <span>{seasonLabel(entry.seasonNumber)}</span>}
            <span>{entry.watchedOn ? formatDate(entry.watchedOn) : "Date unknown"}</span>
            {entry.review && <FileText className="size-3.5" aria-label="Has review" />}
            {entry.rewatch && <Repeat className="size-3.5" aria-label="Rewatch" />}
            {entry.liked && <Heart className="size-3.5 fill-accent text-accent" aria-label="Liked" />}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className={cn("text-sm font-bold tabular-nums", entry.rating ? "text-gold" : "text-dim")}>{entry.rating ? `${entry.rating}/10` : "–"}</span>
          {entry.status === "fills-date" ? (
            <span className="text-[11px] text-gold">{STATUS_LABEL[entry.status]}</span>
          ) : skipped ? (
            <span className="text-[11px] text-dim">{STATUS_LABEL[entry.status]}</span>
          ) : entry.confidence === "check" ? (
            <span className="text-[11px] text-gold">Check this match</span>
          ) : null}
          {entry.mediaType === "movie" && entry.source !== "tmdb" && !fixing && (
            <button type="button" onClick={() => setFixing(true)} className="text-[11px] text-muted underline-offset-2 hover:text-fg hover:underline">
              {m ? "Wrong movie?" : "Find it"}
            </button>
          )}
        </div>
      </div>
      {fixing && (
        <FixMatch
          initial={entry.title}
          onCancel={() => setFixing(false)}
          onPick={(match) => {
            setFixing(false);
            onChange({ match, confidence: "exact", include: isActive(entry.status) || entry.status === "conflict" });
          }}
        />
      )}
    </li>
  );
}

export function ImportWizard({ plexConnected = false, highlightPlex = false }: { plexConnected?: boolean; highlightPlex?: boolean }) {
  const [stage, setStage] = useState<Stage>({ name: "pick" });
  const [entries, setEntries] = useState<Entry[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const fileInput = useRef<HTMLInputElement>(null);

  const start = async (files: File[]) => {
    if (!files.length) return;
    try {
      setStage({ name: "working", label: "Reading your files…", done: 0, total: 1 });
      await review(await parseImportFiles(files), "Couldn't find any diary entries or ratings in those files.");
    } catch (error) {
      console.error(error);
      setStage({ name: "pick", error: "Something went wrong reading those files. Make sure they're the original export files." });
    }
  };

  const startPlex = async () => {
    try {
      setStage({ name: "working", label: "Reading your Plex history… (a big library can take a minute)", done: 0, total: 1 });
      const result = await getPlexImportRows(Intl.DateTimeFormat().resolvedOptions().timeZone);
      if ("error" in result) {
        setStage({ name: "pick", error: result.error });
        return;
      }
      await review(result, "Plex didn't return any watch history for that account.");
    } catch (error) {
      console.error(error);
      setStage({ name: "pick", error: "Couldn't read your Plex history. Is the server running?" });
    }
  };

  /** Match → check against your diary → show the review list. */
  const review = async (parsed: ParseResult, emptyMessage: string) => {
    setNotes(parsed.notes);
    if (!parsed.rows.length) {
      setStage({ name: "pick", error: emptyMessage });
      return;
    }

    // Match films without a TMDB id yet (Letterboxd, or Plex items deleted from the library): one lookup per film.
    const films = [...new Map(parsed.rows.filter((r) => r.tmdbId === null).map((r) => [filmKey(r.title, r.year), { title: r.title, year: r.year }])).values()];
    const matches = new Map<string, { match: ImportMatch | null; confidence: MatchConfidence }>();
    let done = 0;
    for (const batch of chunk(films, 20)) {
      setStage({ name: "working", label: "Matching films to TMDB…", done, total: films.length });
      const results = await matchFilms(batch);
      batch.forEach((f, i) => matches.set(filmKey(f.title, f.year), results[i]));
      done += batch.length;
    }

    let next: Entry[] = parsed.rows.map((row) => {
      const found =
        row.tmdbId !== null
          ? { match: { tmdbId: row.tmdbId, title: row.title, year: row.year, posterPath: null }, confidence: "exact" as const }
          : (matches.get(filmKey(row.title, row.year)) ?? { match: null, confidence: "none" as const });
      return { ...row, ...found, status: "new", include: false };
    });

    // Letterboxd wins: skip TMDB ratings for films that are in the Letterboxd import.
    const letterboxdIds = new Set(next.filter((e) => e.source === "letterboxd" && e.match).map((e) => e.match!.tmdbId));
    setStage({ name: "working", label: "Checking what's already in your diary…", done: 0, total: 1 });
    const withMatch = next.filter((e) => e.match).map((e) => ({ ...e, tmdbId: e.match!.tmdbId }));
    const statuses: Record<string, ImportStatus> = {};
    const undated: string[] = [];
    for (const batch of chunk(withMatch, 2000)) {
      const res = await checkImportStatus(
        batch.map((e) => ({ key: e.key, mediaType: e.mediaType, tmdbId: e.tmdbId, watchedOn: e.watchedOn, seasonNumber: e.seasonNumber })),
      );
      Object.assign(statuses, res.statuses);
      undated.push(...res.undated);
    }
    // The earliest dated play of a title you already have as "date unknown" fills in that entry's date.
    const fills = pickDateFills(withMatch, statuses, undated);
    next = next.map((e) => {
      let status: ImportStatus = fills.has(e.key) ? "fills-date" : (statuses[e.key] ?? "new");
      if (status === "new" && e.source === "tmdb" && e.mediaType === "movie" && letterboxdIds.has(e.tmdbId!)) status = "conflict";
      return { ...e, status, include: Boolean(e.match) && isActive(status) };
    });
    // Dated entries first (newest first), then date-unknown.
    next.sort((a, b) => (b.watchedOn ?? "").localeCompare(a.watchedOn ?? "") || a.title.localeCompare(b.title));
    setEntries(next);
    setFilter("all");
    setStage({ name: "review" });
  };

  const runImport = async () => {
    const chosen = entries.filter((e) => e.include && e.match);
    const total: CommitResult = { imported: 0, datesFilled: 0, skipped: 0, failed: [] };
    let done = 0;
    setStage({ name: "importing", done, total: chosen.length });
    for (const batch of chunk(chosen, 25)) {
      const result = await commitImport(
        batch.map((e) => ({
          key: e.key,
          mediaType: e.mediaType,
          tmdbId: e.match!.tmdbId,
          title: e.match!.title,
          watchedOn: e.watchedOn,
          seasonNumber: e.seasonNumber,
          rating: e.rating,
          rewatch: e.rewatch,
          liked: e.liked,
          review: e.review,
          tags: e.tags,
          watchedWhere: e.watchedWhere,
          fillUndated: e.status === "fills-date",
        })),
      );
      total.imported += result.imported;
      total.datesFilled += result.datesFilled;
      total.skipped += result.skipped;
      total.failed.push(...result.failed);
      done += batch.length;
      setStage({ name: "importing", done, total: chosen.length });
    }
    await finishImport();
    setStage({ name: "done", result: total });
  };

  const counts = useMemo(
    () => ({
      all: entries.length,
      check: entries.filter((e) => e.confidence === "check" && isActive(e.status)).length,
      missing: entries.filter((e) => !e.match).length,
      skipped: entries.filter((e) => !isActive(e.status)).length,
      selected: entries.filter((e) => e.include).length,
    }),
    [entries],
  );
  const visible = entries.filter((e) =>
    filter === "check" ? e.confidence === "check" && isActive(e.status) : filter === "missing" ? !e.match : filter === "skipped" ? !isActive(e.status) : true,
  );

  if (stage.name === "working") return <Progress label={stage.label} done={stage.done} total={stage.total} />;
  if (stage.name === "importing") return <Progress label="Importing… keep this tab open." done={stage.done} total={stage.total} />;

  if (stage.name === "done") {
    const r = stage.result;
    return (
      <div className="max-w-xl rounded-xl border border-line bg-surface p-6">
        <div className="mb-3 grid size-10 place-items-center rounded-full bg-gold/15 text-gold">
          <Check className="size-5" />
        </div>
        <h2 className="text-xl font-bold">Imported {r.imported.toLocaleString()} entries</h2>
        <p className="mt-1 text-sm text-muted">
          {r.datesFilled > 0 && `Filled in the date on ${r.datesFilled} existing entries. `}
          {r.skipped > 0 && `${r.skipped} were already there and skipped. `}
          {r.failed.length > 0 && `${r.failed.length} couldn't be loaded from TMDB: ${r.failed.slice(0, 5).join(", ")}${r.failed.length > 5 ? "…" : ""}`}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/library" className="rounded bg-accent px-5 py-2 font-semibold text-white hover:bg-accent-hover">
            See your library
          </Link>
          <Link href="/stats" className="rounded border border-line px-5 py-2 hover:border-fg/40">
            Stats
          </Link>
          <button type="button" onClick={() => setStage({ name: "pick" })} className="px-3 py-2 text-sm text-muted hover:text-fg">
            Import more
          </button>
        </div>
      </div>
    );
  }

  if (stage.name === "pick") {
    return (
      <div className="max-w-2xl space-y-6">
        {plexConnected && (
          <div className={cn("flex flex-wrap items-center gap-4 rounded-xl border bg-surface p-5", highlightPlex ? "border-[#e5a00d]/60" : "border-line")}>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Import from Plex</p>
              <p className="text-sm text-muted">
                Every movie you&apos;ve played (one entry per day) and every season you&apos;ve finished. Plays of movies you already have as
                &ldquo;date unknown&rdquo; fill in that date instead of adding a duplicate.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void startPlex()}
              className="rounded bg-[#e5a00d] px-5 py-2.5 text-sm font-semibold text-black hover:bg-[#f0b429]"
            >
              Read my Plex history
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            void start([...e.dataTransfer.files]);
          }}
          className="flex w-full flex-col items-center gap-3 rounded-xl border-2 border-dashed border-line bg-surface px-6 py-14 text-center transition hover:border-fg/40"
        >
          <Upload className="size-8 text-muted" />
          <span className="text-lg font-semibold">Drop your export files here, or click to choose</span>
          <span className="text-sm text-muted">Letterboxd .zip (or its diary/reviews/ratings CSVs) and/or TMDB ratings CSVs. You can pick several at once.</span>
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".zip,.csv"
          multiple
          className="hidden"
          onChange={(e) => {
            void start([...(e.target.files ?? [])]);
            e.target.value = "";
          }}
        />
        {stage.error && <p className="text-sm text-accent">{stage.error}</p>}
        <div className="grid gap-4 text-sm sm:grid-cols-2">
          <div className="rounded-xl border border-line bg-surface p-5">
            <p className="mb-2 font-semibold">From Letterboxd</p>
            <p className="text-muted">Settings → Data → Export your data. Upload the .zip as-is. Diary dates, ratings (½★ → 1–10), rewatches, tags, reviews and likes come across.</p>
          </div>
          <div className="rounded-xl border border-line bg-surface p-5">
            <p className="mb-2 font-semibold">From TMDB</p>
            <p className="text-muted">Your profile → Ratings → ⋯ → Export CSV (Movies and TV separately; TMDB emails them). Ratings come in as “date unknown”, rounded to whole numbers.</p>
          </div>
        </div>
      </div>
    );
  }

  // Review
  const tabs: [Filter, string, number][] = [
    ["all", "All", counts.all],
    ["check", "Check these", counts.check],
    ["missing", "Not found", counts.missing],
    ["skipped", "Skipped", counts.skipped],
  ];
  return (
    <div className="max-w-4xl pb-28">
      <ul className="mb-6 space-y-1 text-sm text-muted">
        {notes.map((n) => (
          <li key={n}>• {n}</li>
        ))}
      </ul>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {tabs.map(([key, label, n]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={cn("rounded-full border px-3.5 py-1.5 text-sm", filter === key ? "border-fg bg-fg text-bg" : "border-line text-muted hover:text-fg")}
          >
            {label} <span className="tabular-nums opacity-70">{n}</span>
          </button>
        ))}
        <span className="ml-auto flex gap-3 text-xs">
          <button type="button" className="text-muted hover:text-fg" onClick={() => setEntries((all) => all.map((e) => (visible.includes(e) && e.match ? { ...e, include: true } : e)))}>
            Select shown
          </button>
          <button type="button" className="text-muted hover:text-fg" onClick={() => setEntries((all) => all.map((e) => (visible.includes(e) ? { ...e, include: false } : e)))}>
            Deselect shown
          </button>
        </span>
      </div>
      <ul className="rounded-xl border border-line bg-surface">
        {visible.length === 0 && <li className="p-6 text-center text-sm text-muted">Nothing here.</li>}
        {visible.map((entry) => (
          <EntryRow
            key={entry.key}
            entry={entry}
            onChange={(patch) => setEntries((all) => all.map((e) => (e.key === entry.key ? { ...e, ...patch } : e)))}
          />
        ))}
      </ul>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/95 px-4 py-4 backdrop-blur sm:px-8 lg:px-12">
        <div className="flex max-w-4xl items-center gap-4">
          <p className="text-sm text-muted">
            <span className="font-semibold text-fg">{counts.selected.toLocaleString()}</span> selected
            {counts.check > 0 && <> · {counts.check} to double-check</>}
          </p>
          <button type="button" onClick={() => setStage({ name: "pick" })} className="ml-auto text-sm text-muted hover:text-fg">
            Start over
          </button>
          <button
            type="button"
            disabled={!counts.selected}
            onClick={() => void runImport()}
            className="rounded bg-accent px-6 py-2.5 font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
          >
            Import {counts.selected.toLocaleString()}
          </button>
        </div>
      </div>
    </div>
  );
}
