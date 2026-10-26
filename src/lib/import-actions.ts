"use server";

import { and, eq, isNotNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb, titles, viewings } from "@/db";
import { requireUser } from "./auth";
import { reviewTextToHtml } from "./reviews";
import { ensureTitle } from "./title-cache";
import { searchMovies, type MovieSearchHit } from "./tmdb";

export type ImportMatch = { tmdbId: number; title: string; year: number | null; posterPath: string | null };
export type MatchConfidence = "exact" | "check" | "none";
/**
 * new        — will be imported
 * imported   — this exact entry was imported before
 * same-day   — you already logged this title on that date
 * in-library — (date-unknown entries) the title is already in your library
 * conflict   — TMDB rating for a film that's also in your Letterboxd import (Letterboxd wins)
 */
export type ImportStatus = "new" | "imported" | "same-day" | "in-library" | "conflict";

/** Runs `fn` over items with at most `limit` in flight, preserving order. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

const normTitle = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "");

function bestHit(hits: MovieSearchHit[], title: string, year: number | null) {
  const wanted = normTitle(title);
  const sameTitle = (h: MovieSearchHit) => normTitle(h.title) === wanted || normTitle(h.originalTitle) === wanted;
  const near = (h: MovieSearchHit) => year === null || (h.year !== null && Math.abs(h.year - year) <= 1);
  return hits.find((h) => sameTitle(h) && h.year === year) ?? hits.find((h) => sameTitle(h) && near(h)) ?? hits.find(near) ?? null;
}

/** Finds the TMDB movie for each Letterboxd film (title + year). */
export async function matchFilms(films: { title: string; year: number | null }[]) {
  await requireUser();
  const input = z
    .array(z.object({ title: z.string().min(1).max(300), year: z.number().int().nullable() }))
    .max(50)
    .parse(films);

  return mapLimit(input, 6, async ({ title, year }): Promise<{ match: ImportMatch | null; confidence: MatchConfidence }> => {
    try {
      let hits = await searchMovies(title, year);
      let hit = bestHit(hits, title, year);
      if (!hit && year !== null) {
        // Letterboxd and TMDB sometimes disagree on the release year by one.
        hits = await searchMovies(title, null);
        hit = bestHit(hits, title, year);
      }
      if (!hit) return { match: null, confidence: "none" };
      const exact = normTitle(hit.title) === normTitle(title) || normTitle(hit.originalTitle) === normTitle(title);
      return {
        match: { tmdbId: hit.id, title: hit.title, year: hit.year, posterPath: hit.posterPath },
        confidence: exact && (year === null || hit.year === year) ? "exact" : "check",
      };
    } catch {
      return { match: null, confidence: "none" };
    }
  });
}

const statusInput = z
  .array(
    z.object({
      key: z.string().max(400),
      mediaType: z.enum(["movie", "tv"]),
      tmdbId: z.number().int().positive(),
      watchedOn: z.string().nullable(),
    }),
  )
  .max(5000);

/** Flags entries that are already in your diary, so they're unticked by default. */
export async function checkImportStatus(items: z.infer<typeof statusInput>): Promise<Record<string, ImportStatus>> {
  const user = await requireUser();
  const input = statusInput.parse(items);
  const db = await getDb();
  const existing = await db
    .select({ importKey: viewings.importKey, watchedOn: viewings.watchedOn, tmdbId: titles.tmdbId, mediaType: titles.mediaType })
    .from(viewings)
    .innerJoin(titles, eq(viewings.titleId, titles.id))
    .where(eq(viewings.userId, user.id));

  const importedKeys = new Set(existing.map((e) => e.importKey).filter(Boolean));
  const loggedTitles = new Set(existing.map((e) => `${e.mediaType}-${e.tmdbId}`));
  const loggedDays = new Set(existing.map((e) => `${e.mediaType}-${e.tmdbId}-${e.watchedOn}`));

  const result: Record<string, ImportStatus> = {};
  for (const item of input) {
    const titleKey = `${item.mediaType}-${item.tmdbId}`;
    if (importedKeys.has(item.key)) result[item.key] = "imported";
    else if (item.watchedOn && loggedDays.has(`${titleKey}-${item.watchedOn}`)) result[item.key] = "same-day";
    else if (!item.watchedOn && loggedTitles.has(titleKey)) result[item.key] = "in-library";
    else result[item.key] = "new";
  }
  return result;
}

const commitInput = z
  .array(
    z.object({
      key: z.string().min(1).max(400),
      mediaType: z.enum(["movie", "tv"]),
      tmdbId: z.number().int().positive(),
      title: z.string().max(300),
      watchedOn: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .nullable(),
      rating: z.number().int().min(1).max(10).nullable(),
      rewatch: z.boolean(),
      liked: z.boolean(),
      review: z.string().max(100_000).nullable(),
      tags: z.array(z.string().max(60)).max(30),
    }),
  )
  .max(50);

export type CommitResult = { imported: number; skipped: number; failed: string[] };

/** Saves one batch of entries. The page sends batches so it can show progress. */
export async function commitImport(rows: z.infer<typeof commitInput>): Promise<CommitResult> {
  const user = await requireUser();
  const input = commitInput.parse(rows);
  const db = await getDb();
  const result: CommitResult = { imported: 0, skipped: 0, failed: [] };

  // Entries for the same title run in order (so only one becomes the main review); different titles run in parallel.
  const groups = [...Map.groupBy(input, (r) => `${r.mediaType}-${r.tmdbId}`).values()];
  await mapLimit(groups, 6, async (group) => {
    let titleId: number;
    try {
      titleId = await ensureTitle(db, group[0].tmdbId, group[0].mediaType);
    } catch {
      result.failed.push(...group.map((r) => r.title));
      return;
    }
    for (const row of group) {
      const reviewHtml = reviewTextToHtml(row.review);
      const [main] = reviewHtml
        ? await db
            .select({ id: viewings.id })
            .from(viewings)
            .where(and(eq(viewings.userId, user.id), eq(viewings.titleId, titleId), eq(viewings.isMainReview, true), isNotNull(viewings.reviewHtml)))
            .limit(1)
        : [];
      const inserted = await db
        .insert(viewings)
        .values({
          userId: user.id,
          titleId,
          watchedOn: row.watchedOn,
          seasonNumber: null,
          rating: row.rating,
          liked: row.liked,
          isRewatch: row.rewatch,
          reviewHtml,
          isMainReview: Boolean(reviewHtml) && !main,
          tags: row.tags,
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

export async function finishImport() {
  await requireUser();
  revalidatePath("/", "layout");
}
