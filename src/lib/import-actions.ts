"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { requireUser } from "./auth";
import { getImportStatuses, mapLimit, saveImportRows, type ImportStatus, type SaveResult } from "./import-save";
import type { ImportRow } from "./import-parse";
import { getTvDetails, searchMovies, searchTv, type MovieSearchHit } from "./tmdb";

export type ImportMatch = { tmdbId: number; title: string; year: number | null; posterPath: string | null };
export type MatchConfidence = "exact" | "check" | "none";
export type { ImportStatus };

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

const netflixInput = z
  .array(
    z.object({
      show: z.string().min(1).max(300),
      season: z.number().int().min(0).max(200),
      episodes: z.number().int().min(1),
      lastWatched: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
  )
  .max(300);

/**
 * Netflix seasons → diary rows. Finds each show on TMDB and keeps only seasons you watched every episode of
 * (dated when you watched the last one) — same rule as Plex.
 */
export async function matchNetflixSeasons(seasons: z.infer<typeof netflixInput>) {
  await requireUser();
  const input = netflixInput.parse(seasons);
  const shows = [...new Set(input.map((s) => s.show))];
  const showIds = new Map<string, number | null>();
  await mapLimit(shows, 6, async (show) => {
    try {
      const hits = await searchTv(show);
      const wanted = normTitle(show);
      const hit = hits.find((h) => normTitle(h.name) === wanted || normTitle(h.originalName) === wanted) ?? hits[0];
      showIds.set(show, hit?.id ?? null);
    } catch {
      showIds.set(show, null);
    }
  });

  const rows: ImportRow[] = [];
  let inProgress = 0;
  let unmatched = 0;
  await mapLimit(input, 6, async (s) => {
    const tmdbId = showIds.get(s.show);
    if (!tmdbId) {
      unmatched++;
      return;
    }
    const details = await getTvDetails(tmdbId).catch(() => null);
    const episodeCount = details?.seasons.find((x) => x.number === s.season)?.episodeCount ?? 0;
    if (!details || !episodeCount || s.episodes < episodeCount) {
      inProgress++;
      return;
    }
    rows.push({
      source: "netflix",
      key: `netflix:tv:${tmdbId}:s${s.season}`,
      mediaType: "tv",
      tmdbId,
      title: details.title,
      year: details.year,
      watchedOn: s.lastWatched,
      seasonNumber: s.season,
      rating: null,
      rewatch: false,
      liked: false,
      review: null,
      tags: [],
      watchedWhere: "Netflix",
    });
  });
  return { rows, completed: rows.length, inProgress, unmatched };
}

const statusInput = z
  .array(
    z.object({
      key: z.string().max(400),
      mediaType: z.enum(["movie", "tv"]),
      tmdbId: z.number().int().positive(),
      watchedOn: z.string().nullable(),
      seasonNumber: z.number().int().min(0).nullable(),
    }),
  )
  .max(5000);

/** Flags entries that are already in your diary, and titles with a "date unknown" entry a dated import can fill in. */
export async function checkImportStatus(items: z.infer<typeof statusInput>) {
  const user = await requireUser();
  const db = await getDb();
  return getImportStatuses(db, user.id, statusInput.parse(items));
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
      seasonNumber: z.number().int().min(0).nullable(),
      rating: z.number().int().min(1).max(10).nullable(),
      rewatch: z.boolean(),
      liked: z.boolean(),
      review: z.string().max(100_000).nullable(),
      tags: z.array(z.string().max(60)).max(30),
      watchedWhere: z.string().max(80).nullable(),
      fillUndated: z.boolean(),
    }),
  )
  .max(50);

export type CommitResult = SaveResult;

/** Saves one batch of entries. The page sends batches so it can show progress. */
export async function commitImport(rows: z.infer<typeof commitInput>): Promise<CommitResult> {
  const user = await requireUser();
  const db = await getDb();
  return saveImportRows(db, user.id, commitInput.parse(rows));
}

export async function finishImport() {
  await requireUser();
  revalidatePath("/", "layout");
}
