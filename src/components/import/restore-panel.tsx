"use client";

import { ArchiveRestore, Check } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { strFromU8, unzipSync } from "fflate";
import { finishRestore, restoreBackupBatch, restoreBackupLists, restoreProfileSettings } from "@/lib/backup-actions";
import { BACKUP_FILE, backupSchema, type Backup } from "@/lib/backup-format";
import { formatDate, plural } from "@/lib/format";

/** Finds a Row Six backup among the chosen files (the export ZIP or the JSON inside it). */
export async function readBackup(files: File[]): Promise<Backup | "invalid" | null> {
  for (const file of files) {
    const name = file.name.toLowerCase();
    let text: string | null = null;
    if (name.endsWith(".json")) text = await file.text();
    else if (name.endsWith(".zip")) {
      const entries = unzipSync(new Uint8Array(await file.arrayBuffer()), { filter: (f) => f.name.endsWith(BACKUP_FILE) });
      const entry = Object.values(entries)[0];
      if (entry) text = strFromU8(entry);
    }
    if (text === null) continue;
    try {
      const parsed = backupSchema.safeParse(JSON.parse(text));
      return parsed.success ? parsed.data : "invalid";
    } catch {
      return "invalid";
    }
  }
  return null;
}

/** Splits a backup into slices small enough for one request each, keeping each slice's titles with it. */
function slices(backup: Backup) {
  const byRef = new Map(backup.titles.map((t) => [t.ref, t]));
  const out: Pick<Backup, "titles" | "diary" | "watchlist" | "seenBefore">[] = [];
  const withTitles = (refs: string[]) => [...new Set(refs)].map((r) => byRef.get(r)).filter((t) => t !== undefined);

  // Keep a title's diary entries in the same slice.
  const groups = [...Map.groupBy(backup.diary, (d) => d.title).values()];
  let current: Backup["diary"] = [];
  for (const group of groups) {
    if (current.length && current.length + group.length > 100) {
      out.push({ titles: withTitles(current.map((d) => d.title)), diary: current, watchlist: [], seenBefore: [] });
      current = [];
    }
    current.push(...group);
  }
  if (current.length) out.push({ titles: withTitles(current.map((d) => d.title)), diary: current, watchlist: [], seenBefore: [] });

  for (let i = 0; i < backup.watchlist.length; i += 150) {
    const watchlist = backup.watchlist.slice(i, i + 150);
    out.push({ titles: withTitles(watchlist.map((w) => w.title)), diary: [], watchlist, seenBefore: [] });
  }
  for (let i = 0; i < backup.seenBefore.length; i += 150) {
    const seenBefore = backup.seenBefore.slice(i, i + 150);
    out.push({ titles: withTitles(seenBefore.map((s) => s.title)), diary: [], watchlist: [], seenBefore });
  }
  return out;
}

type Totals = { added: number; skipped: number; watchlist: number; seenBefore: number; lists: number; failed: string[] };

/** Shown when you drop a Row Six backup on the import page: what's in it, then the restore with a progress bar. */
export function RestorePanel({ backup, onCancel }: { backup: Backup; onCancel: () => void }) {
  const [withSettings, setWithSettings] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dated = backup.diary.filter((d) => d.watchedOn).length;
  const reviews = backup.diary.filter((d) => d.reviewHtml).length;
  const tv = backup.titles.filter((t) => t.mediaType === "tv").length;

  const restore = async () => {
    setError(null);
    const parts = slices(backup);
    const sum: Totals = { added: 0, skipped: 0, watchlist: 0, seenBefore: 0, lists: 0, failed: [] };
    const units = (p: (typeof parts)[number]) => p.diary.length + p.watchlist.length + p.seenBefore.length;
    const backupLists = backup.lists ?? [];
    const total = parts.reduce((n, p) => n + units(p), 0) + backupLists.length;
    let done = 0;
    setProgress({ done, total });
    try {
      for (const part of parts) {
        const r = await restoreBackupBatch(part);
        sum.added += r.added;
        sum.skipped += r.skipped;
        sum.watchlist += r.watchlist;
        sum.seenBefore += r.seenBefore;
        sum.failed.push(...r.failed);
        done += units(part);
        setProgress({ done, total });
      }
      const byRef = new Map(backup.titles.map((t) => [t.ref, t]));
      for (let i = 0; i < backupLists.length; i += 10) {
        const chunk = backupLists.slice(i, i + 10);
        const refs = new Set(chunk.flatMap((l) => l.items.map((it) => it.title)));
        const r = await restoreBackupLists({ lists: chunk, titles: [...refs].map((ref) => byRef.get(ref)).filter((t) => t !== undefined) });
        sum.lists += r.added;
        sum.failed.push(...r.failed);
        done += chunk.length;
        setProgress({ done, total });
      }
      if (withSettings) await restoreProfileSettings(backup.profile);
      await finishRestore();
      setTotals(sum);
    } catch (e) {
      console.error(e);
      setError(`Restore stopped partway (${done} of ${total} done). Running it again is safe: anything already restored is skipped.`);
    } finally {
      setProgress(null);
    }
  };

  if (totals) {
    return (
      <div className="max-w-xl rounded-xl border border-line bg-surface p-6">
        <div className="mb-3 grid size-10 place-items-center rounded-full bg-gold/15 text-gold">
          <Check className="size-5" />
        </div>
        <h2 className="text-xl font-bold">Restored {plural(totals.added, "diary entry", "diary entries")}</h2>
        <p className="mt-1 text-sm text-muted">
          {totals.skipped > 0 && `${plural(totals.skipped, "entry was", "entries were")} already here and skipped. `}
          {totals.watchlist > 0 && `${plural(totals.watchlist, "watchlist title")} restored. `}
          {totals.lists > 0 && `${plural(totals.lists, "list")} restored. `}
          {totals.failed.length > 0 &&
            `${plural(totals.failed.length, "title")} couldn't be loaded from TMDB: ${totals.failed.slice(0, 5).join(", ")}${totals.failed.length > 5 ? "…" : ""}`}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/library" className="rounded bg-accent px-5 py-2 font-semibold text-white hover:bg-accent-hover">
            See your library
          </Link>
          <Link href="/diary" className="rounded border border-line px-5 py-2 hover:border-fg/40">
            Diary
          </Link>
        </div>
      </div>
    );
  }

  const pct = progress && progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
  return (
    <div className="max-w-xl rounded-xl border border-line bg-surface p-6">
      <div className="mb-4 flex items-start gap-3">
        <ArchiveRestore className="mt-0.5 size-6 shrink-0 text-gold" />
        <div>
          <h2 className="text-xl font-bold">Restore a Row Six backup</h2>
          <p className="text-sm text-muted">
            From {backup.profile.displayName} (@{backup.profile.username}), exported {formatDate(backup.exportedAt.slice(0, 10))}
          </p>
        </div>
      </div>
      <ul className="mb-5 grid gap-1.5 text-sm sm:grid-cols-2">
        <li>
          <span className="font-semibold">{backup.diary.length.toLocaleString()}</span> diary entries{" "}
          <span className="text-dim">({dated.toLocaleString()} dated)</span>
        </li>
        <li>
          <span className="font-semibold">{reviews.toLocaleString()}</span> reviews
        </li>
        <li>
          <span className="font-semibold">{backup.titles.length.toLocaleString()}</span> titles <span className="text-dim">({tv} shows)</span>
        </li>
        <li>
          <span className="font-semibold">{backup.watchlist.length.toLocaleString()}</span> on the watchlist
        </li>
        {(backup.lists?.length ?? 0) > 0 && (
          <li>
            <span className="font-semibold">{backup.lists!.length.toLocaleString()}</span> lists &amp; tier lists
          </li>
        )}
        {backup.seenBefore.length > 0 && (
          <li>
            <span className="font-semibold">{backup.seenBefore.length.toLocaleString()}</span> &ldquo;seen before&rdquo; counts
          </li>
        )}
      </ul>
      <p className="mb-4 text-sm text-muted">
        This <span className="text-fg">adds</span> the backup to this account. Anything already here (same title, season and date) is skipped, so
        nothing is duplicated or deleted. Movie details are re-loaded from TMDB, which can take a minute for a big library.
      </p>
      <label className="mb-6 flex cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" checked={withSettings} onChange={(e) => setWithSettings(e.target.checked)} className="size-4 accent-accent" />
        Also restore profile settings (display name, privacy, hide-watched)
      </label>

      {progress ? (
        <div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-3">
            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-sm tabular-nums text-muted">
            Restoring… {progress.done.toLocaleString()} of {progress.total.toLocaleString()} (keep this tab open)
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => void restore()} className="rounded bg-accent px-6 py-2.5 font-semibold text-white hover:bg-accent-hover">
            Restore into this account
          </button>
          <button type="button" onClick={onCancel} className="px-3 py-2 text-sm text-muted hover:text-fg">
            Cancel
          </button>
        </div>
      )}
      {error && <p className="mt-4 text-sm text-accent">{error}</p>}
    </div>
  );
}
