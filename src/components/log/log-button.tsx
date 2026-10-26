"use client";

import { CalendarOff, Heart, Repeat } from "lucide-react";
import Image from "next/image";
import { useActionState, useState, type ReactNode } from "react";
import { saveViewing, type ActionState } from "@/lib/actions";
import type { LogHistory } from "@/lib/library";
import { cn, type MediaType, seasonLabel, tmdbImage } from "@/lib/format";
import { submitTo } from "@/lib/forms";
import { Modal } from "../ui/modal";
import { RatingPicker } from "./rating-picker";
import { RichTextEditor } from "./rich-text-editor";

export type LogTarget = {
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  year: number | null;
  posterPath: string | null;
  seasons: { number: number; name: string }[];
};

export type { LogHistory };

/** A diary entry, flattened for the client. */
export type ViewingDraft = {
  id: number;
  watchedOn: string | null;
  seasonNumber: number | null;
  rating: number | null;
  liked: boolean;
  isRewatch: boolean;
  reviewHtml: string | null;
  isMainReview: boolean;
  containsSpoilers: boolean;
  watchedWhere: string | null;
  format: string | null;
  watchedWith: string | null;
  tags: string[];
};

const WHERE_OPTIONS = [
  "Theater",
  "Plex",
  "Netflix",
  "HBO Max",
  "Disney+",
  "Hulu",
  "Prime Video",
  "Apple TV",
  "Peacock",
  "Paramount+",
  "YouTube",
  "Blu-ray / DVD",
  "TV broadcast",
];
const FORMAT_OPTIONS = ["Standard", "4K", "IMAX", "Dolby Cinema", "Dolby Vision", "3D", "35mm", "70mm"];

function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function defaultSeason(target: LogTarget, history: LogHistory) {
  const real = target.seasons.filter((s) => s.number > 0);
  const next = real.find((s) => !history.loggedSeasons.includes(s.number));
  return String((next ?? real.at(-1))?.number ?? "series");
}

const inputClass =
  "h-10 w-full rounded-md border border-line bg-bg px-3 text-sm outline-none transition placeholder:text-dim focus:border-fg/40 disabled:opacity-40";

function ToggleChip({
  name,
  checked,
  onChange,
  defaultChecked,
  icon,
  children,
  tone = "fg",
}: {
  name: string;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  defaultChecked?: boolean;
  icon: ReactNode;
  children: ReactNode;
  tone?: "fg" | "accent";
}) {
  return (
    <label className="cursor-pointer select-none">
      <input
        type="checkbox"
        name={name}
        className="peer sr-only"
        checked={checked}
        defaultChecked={defaultChecked}
        onChange={onChange ? (e) => onChange(e.target.checked) : undefined}
      />
      <span
        className={cn(
          "inline-flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-sm text-muted transition hover:text-fg peer-focus-visible:ring-2 peer-focus-visible:ring-fg",
          tone === "accent"
            ? "peer-checked:border-accent peer-checked:bg-accent/15 peer-checked:text-fg [&_svg]:peer-checked:fill-accent [&_svg]:peer-checked:text-accent"
            : "peer-checked:border-fg/60 peer-checked:bg-fg/10 peer-checked:text-fg",
        )}
      >
        {icon}
        {children}
      </span>
    </label>
  );
}

function LogForm({
  target,
  existing,
  history,
  onDone,
  onSaved,
}: {
  target: LogTarget;
  existing?: ViewingDraft;
  history: LogHistory;
  onDone: () => void;
  onSaved?: (rating: number | null) => void;
}) {
  const [state, formAction, pending] = useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await saveViewing(prev, formData);
    if (result.ok) {
      onSaved?.(Number(formData.get("rating")) || null);
      onDone();
    }
    return result;
  }, { ok: false });

  const isTv = target.mediaType === "tv";
  const [today] = useState(localToday);
  const [dateUnknown, setDateUnknown] = useState(existing ? existing.watchedOn === null : false);
  const [season, setSeason] = useState(
    existing ? (existing.seasonNumber === null ? "series" : String(existing.seasonNumber)) : defaultSeason(target, history),
  );
  const rewatchFor = (s: string) =>
    isTv ? history.loggedSeasons.includes(s === "series" ? null : Number(s)) : history.hasHistory;
  const [rewatch, setRewatch] = useState(existing ? existing.isRewatch : rewatchFor(season));
  const [rewatchTouched, setRewatchTouched] = useState(Boolean(existing));

  const poster = tmdbImage(target.posterPath, "w185");

  return (
    <form onSubmit={submitTo(formAction)} className="p-5 sm:p-7">
      <input type="hidden" name="tmdbId" value={target.tmdbId} />
      <input type="hidden" name="mediaType" value={target.mediaType} />
      {existing && <input type="hidden" name="viewingId" value={existing.id} />}

      <div className="mb-6 flex items-center gap-4 pr-8">
        {poster && (
          <div className="relative h-24 w-16 shrink-0 overflow-hidden rounded bg-surface-3">
            <Image src={poster} alt="" fill sizes="64px" className="object-cover" />
          </div>
        )}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">
            {existing ? "Edit diary entry" : "I watched…"}
          </p>
          <h2 className="text-xl font-bold leading-tight sm:text-2xl">
            {target.title}
            {target.year && <span className="ml-2 font-normal text-muted">{target.year}</span>}
          </h2>
        </div>
      </div>

      <div className="grid gap-5">
        <div className={cn("grid gap-4", isTv && "sm:grid-cols-2")}>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted" htmlFor="watchedOn">
              {isTv ? "Finished on" : "Watched on"}
            </label>
            <input
              id="watchedOn"
              type="date"
              name="watchedOn"
              defaultValue={existing?.watchedOn ?? today}
              max={today}
              disabled={dateUnknown}
              className={cn(inputClass, "[color-scheme:dark]")}
            />
            <label className="mt-2 inline-flex cursor-pointer items-center gap-2 text-xs text-muted">
              <input
                type="checkbox"
                name="dateUnknown"
                checked={dateUnknown}
                onChange={(e) => setDateUnknown(e.target.checked)}
                className="accent-accent"
              />
              <CalendarOff className="size-3.5" /> Don&apos;t remember the date
            </label>
          </div>
          {isTv && (
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted" htmlFor="season">
                Season
              </label>
              <select
                id="season"
                name="season"
                value={season}
                onChange={(e) => {
                  setSeason(e.target.value);
                  if (!rewatchTouched) setRewatch(rewatchFor(e.target.value));
                }}
                className={inputClass}
              >
                {target.seasons.map((s) => (
                  <option key={s.number} value={s.number}>
                    {s.number === 0 ? "Specials" : s.name || seasonLabel(s.number)}
                    {history.loggedSeasons.includes(s.number) ? " ✓" : ""}
                  </option>
                ))}
                <option value="series">Entire series</option>
              </select>
            </div>
          )}
        </div>

        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted">Your rating</p>
          <RatingPicker name="rating" defaultValue={existing?.rating ?? null} />
        </div>

        <div className="flex flex-wrap gap-2">
          <ToggleChip name="liked" defaultChecked={existing?.liked} icon={<Heart className="size-4" />} tone="accent">
            Liked
          </ToggleChip>
          <ToggleChip
            name="isRewatch"
            checked={rewatch}
            onChange={(checked) => {
              setRewatch(checked);
              setRewatchTouched(true);
            }}
            icon={<Repeat className="size-4" />}
          >
            Rewatch
          </ToggleChip>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted">Review</p>
          <RichTextEditor
            name="review"
            defaultValue={existing?.reviewHtml ?? null}
            placeholder={isTv ? "How was this season?" : "What did you think?"}
          />
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
            <label className="inline-flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                name="isMainReview"
                defaultChecked={existing ? existing.isMainReview : !history.hasMainReview}
                className="accent-gold"
              />
              Make this my main review
            </label>
            <label className="inline-flex cursor-pointer items-center gap-2">
              <input type="checkbox" name="containsSpoilers" defaultChecked={existing?.containsSpoilers} className="accent-accent" />
              Contains spoilers
            </label>
          </div>
        </div>

        <details
          className="group rounded-lg border border-line"
          open={Boolean(existing?.watchedWhere || existing?.format || existing?.watchedWith || existing?.tags.length)}
        >
          <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-muted hover:text-fg">
            More details <span className="text-dim">· where, format, who with, tags</span>
          </summary>
          <div className="grid gap-4 border-t border-line p-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs text-muted" htmlFor="watchedWhere">
                Where
              </label>
              <input
                id="watchedWhere"
                name="watchedWhere"
                list="where-options"
                defaultValue={existing?.watchedWhere ?? ""}
                placeholder="Theater, Plex, Netflix…"
                className={inputClass}
              />
              <datalist id="where-options">
                {WHERE_OPTIONS.map((o) => (
                  <option key={o} value={o} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-muted" htmlFor="format">
                Format
              </label>
              <input
                id="format"
                name="format"
                list="format-options"
                defaultValue={existing?.format ?? ""}
                placeholder="IMAX, 4K…"
                className={inputClass}
              />
              <datalist id="format-options">
                {FORMAT_OPTIONS.map((o) => (
                  <option key={o} value={o} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-muted" htmlFor="watchedWith">
                Watched with
              </label>
              <input
                id="watchedWith"
                name="watchedWith"
                defaultValue={existing?.watchedWith ?? ""}
                placeholder="Names"
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-muted" htmlFor="tags">
                Tags
              </label>
              <input
                id="tags"
                name="tags"
                defaultValue={existing?.tags.join(", ") ?? ""}
                placeholder="halloween, date night"
                className={inputClass}
              />
            </div>
          </div>
        </details>
      </div>

      <div className="mt-7 flex items-center justify-end gap-3">
        {state.error && <p className="mr-auto text-sm text-accent">{state.error}</p>}
        <button type="button" onClick={onDone} className="rounded px-4 py-2 text-sm text-muted hover:text-fg">
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-accent px-6 py-2 text-sm font-semibold text-white transition hover:bg-accent-hover disabled:opacity-60"
        >
          {pending ? "Saving…" : existing ? "Save changes" : "Save to diary"}
        </button>
      </div>
    </form>
  );
}

/** The log popup on its own, for places that open it themselves (e.g. poster hover buttons). */
export function LogDialog({
  open,
  onClose,
  target,
  existing,
  history,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  target: LogTarget;
  existing?: ViewingDraft;
  history: LogHistory;
  /** Called with the rating you gave (or null) after a successful save. */
  onSaved?: (rating: number | null) => void;
}) {
  return (
    <Modal open={open} onClose={onClose} label={`Log ${target.title}`}>
      <LogForm target={target} existing={existing} history={history} onDone={onClose} onSaved={onSaved} />
    </Modal>
  );
}

export function LogButton({
  target,
  existing,
  history,
  className,
  children,
}: {
  target: LogTarget;
  existing?: ViewingDraft;
  history: LogHistory;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {children}
      </button>
      <LogDialog open={open} onClose={() => setOpen(false)} target={target} existing={existing} history={history} />
    </>
  );
}
