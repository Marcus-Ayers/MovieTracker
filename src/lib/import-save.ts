import "server-only";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { titles, viewings, type DB } from "@/db";
import { mapLimit } from "./async";
import type { MediaType } from "./format";
import { reviewTextToHtml } from "./reviews";
import { ensureTitle } from "./title-cache";

/**
 * new        — will be imported
 * imported   — this exact entry was imported before
 * same-day   — you already logged this title (and season) on that date
 * in-library — (date-unknown entries) the title is already in your library
 * conflict   — TMDB rating for a film that's also in your Letterboxd import (Letterboxd wins)
 * fills-date — fills in the date on an existing "date unknown" entry instead of adding a new one
 */
export type ImportStatus = "new" | "imported" | "same-day" | "in-library" | "conflict" | "fills-date";

export type SaveRow = {
  key: string;
  mediaType: MediaType;
  tmdbId: number;
  title: string;
  watchedOn: string | null;
  seasonNumber: number | null;
  rating: number | null;
  rewatch: boolean;
  liked: boolean;
  review: string | null;
  tags: string[];
  watchedWhere: string | null;
  /** Put this date on an existing undated entry for the title, if there is one. */
  fillUndated: boolean;
};

export type SaveResult = { imported: number; datesFilled: number; skipped: number; failed: string[] };


type StatusItem = { key: string; mediaType: MediaType; tmdbId: number; watchedOn: string | null; seasonNumber: number | null };

/**
 * Compares incoming entries with your diary. Also returns which titles have a "date unknown" entry
 * (so a dated import can fill the date in rather than duplicate it).
 */
export async function getImportStatuses(db: DB, userId: number, items: StatusItem[]) {
  const existing = await db
    .select({
      importKey: viewings.importKey,
      watchedOn: viewings.watchedOn,
      seasonNumber: viewings.seasonNumber,
      tmdbId: titles.tmdbId,
      mediaType: titles.mediaType,
    })
    .from(viewings)
    .innerJoin(titles, eq(viewings.titleId, titles.id))
    .where(eq(viewings.userId, userId));

  const importedKeys = new Set(existing.map((e) => e.importKey).filter(Boolean));
  const loggedTitles = new Set(existing.map((e) => `${e.mediaType}-${e.tmdbId}`));
  const loggedDays = new Set(existing.map((e) => `${e.mediaType}-${e.tmdbId}-${e.seasonNumber ?? "-"}-${e.watchedOn}`));
  const undated = new Set(existing.filter((e) => !e.watchedOn && e.seasonNumber === null).map((e) => `${e.mediaType}-${e.tmdbId}`));

  const statuses: Record<string, ImportStatus> = {};
  for (const item of items) {
    const titleKey = `${item.mediaType}-${item.tmdbId}`;
    if (importedKeys.has(item.key)) statuses[item.key] = "imported";
    else if (item.watchedOn && loggedDays.has(`${titleKey}-${item.seasonNumber ?? "-"}-${item.watchedOn}`)) statuses[item.key] = "same-day";
    else if (!item.watchedOn && loggedTitles.has(titleKey)) statuses[item.key] = "in-library";
    else statuses[item.key] = "new";
  }
  return { statuses, undated: [...undated] };
}

/** Saves entries (from an import or a Plex sync). Re-running is safe: import keys and same-day checks skip repeats. */
export async function saveImportRows(db: DB, userId: number, rows: SaveRow[]): Promise<SaveResult> {
  const result: SaveResult = { imported: 0, datesFilled: 0, skipped: 0, failed: [] };

  // Entries for the same title run in order (so only one becomes the main review); different titles run in parallel.
  const groups = [...Map.groupBy(rows, (r) => `${r.mediaType}-${r.tmdbId}`).values()];
  await mapLimit(groups, 6, async (group) => {
    let titleId: number;
    try {
      titleId = await ensureTitle(db, group[0].tmdbId, group[0].mediaType);
    } catch {
      result.failed.push(...group.map((r) => r.title));
      return;
    }
    for (const row of group) {
      if (row.fillUndated && row.watchedOn) {
        const [undated] = await db
          .select({ id: viewings.id, watchedWhere: viewings.watchedWhere })
          .from(viewings)
          .where(and(eq(viewings.userId, userId), eq(viewings.titleId, titleId), isNull(viewings.watchedOn), isNull(viewings.seasonNumber)))
          .limit(1);
        if (undated) {
          await db
            .update(viewings)
            .set({ watchedOn: row.watchedOn, watchedWhere: undated.watchedWhere ?? row.watchedWhere, updatedAt: new Date() })
            .where(eq(viewings.id, undated.id));
          result.datesFilled++;
          continue;
        }
      }

      const reviewHtml = reviewTextToHtml(row.review);
      const [main] = reviewHtml
        ? await db
            .select({ id: viewings.id })
            .from(viewings)
            .where(and(eq(viewings.userId, userId), eq(viewings.titleId, titleId), eq(viewings.isMainReview, true), isNotNull(viewings.reviewHtml)))
            .limit(1)
        : [];
      const inserted = await db
        .insert(viewings)
        .values({
          userId,
          titleId,
          watchedOn: row.watchedOn,
          seasonNumber: row.mediaType === "tv" ? row.seasonNumber : null,
          rating: row.rating,
          liked: row.liked,
          isRewatch: row.rewatch,
          reviewHtml,
          isMainReview: Boolean(reviewHtml) && !main,
          tags: row.tags,
          watchedWhere: row.watchedWhere,
          importKey: row.key,
        })
        .onConflictDoNothing({ target: [viewings.userId, viewings.importKey] })
        .returning({ id: viewings.id });
      if (inserted.length) result.imported++;
      else result.skipped++;
    }
  });
  return result;
}
