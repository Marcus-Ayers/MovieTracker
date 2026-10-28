"use client";

/**
 * Logging something you watched: the "Log" button and the dialog it opens. The form inside the dialog
 * (log-form.tsx) is loaded on demand, because its review editor is the heaviest code on the site.
 */

import dynamic from "next/dynamic";
import { useState, type ReactNode } from "react";
import type { LogHistory } from "@/lib/library";
import type { MediaType } from "@/lib/format";
import { Modal } from "../ui/modal";

/** What's being logged: enough about the title to show it and pick a season, without loading its full details. */
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

/** Starts downloading the log form early (on hover, or when a sheet that leads to it opens), so it opens instantly. */
export const preloadLogForm = () => void import("./log-form");

const LogForm = dynamic(() => import("./log-form").then((m) => m.LogForm), {
  loading: () => (
    <div className="space-y-4 p-5 sm:p-7" aria-label="Loading">
      <div className="flex gap-4">
        <div className="h-24 w-16 animate-pulse rounded bg-surface-3" />
        <div className="h-8 w-48 animate-pulse self-center rounded bg-surface-3" />
      </div>
      <div className="h-10 animate-pulse rounded bg-surface-3" />
      <div className="h-24 animate-pulse rounded bg-surface-3" />
      <div className="h-40 animate-pulse rounded bg-surface-3" />
    </div>
  ),
});

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

/** A button that opens the log dialog for one title (e.g. "Log" / "Log again" / "Edit" on title pages). */
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
      <button type="button" onClick={() => setOpen(true)} onPointerEnter={preloadLogForm} onFocus={preloadLogForm} className={className}>
        {children}
      </button>
      <LogDialog open={open} onClose={() => setOpen(false)} target={target} existing={existing} history={history} />
    </>
  );
}
