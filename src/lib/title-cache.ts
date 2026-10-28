import "server-only";
import { and, asc, eq, lt, sql } from "drizzle-orm";
import { credits, people, titles, type DB } from "@/db";
import type { MediaType } from "./format";
import { getTitleDetails } from "./tmdb";

// TMDB's terms allow caching for up to 6 months; refresh well before that.
const REFRESH_AFTER_MS = 90 * 24 * 60 * 60 * 1000;

/** Nightly: re-pull the oldest cached titles so nothing gets older than TMDB allows. */
export async function refreshStaleTitles(db: DB, limit = 150) {
  const stale = await db
    .select({ tmdbId: titles.tmdbId, mediaType: titles.mediaType })
    .from(titles)
    .where(lt(titles.refreshedAt, new Date(Date.now() - REFRESH_AFTER_MS)))
    .orderBy(asc(titles.refreshedAt))
    .limit(limit);
  let refreshed = 0;
  for (const t of stale) {
    try {
      await ensureTitle(db, t.tmdbId, t.mediaType, { force: true });
      refreshed++;
    } catch {
      // Try again tomorrow.
    }
  }
  return { refreshed };
}

/**
 * Makes sure a TMDB title (and its directors/writers/cast) is stored locally,
 * so the library, diary, and stats never need to call TMDB. Returns the local id.
 */
export async function ensureTitle(db: DB, tmdbId: number, mediaType: MediaType, { force = false } = {}) {
  const [existing] = await db
    .select({ id: titles.id, refreshedAt: titles.refreshedAt })
    .from(titles)
    .where(and(eq(titles.tmdbId, tmdbId), eq(titles.mediaType, mediaType)));
  if (existing && !force && Date.now() - existing.refreshedAt.getTime() < REFRESH_AFTER_MS) return existing.id;

  const d = await getTitleDetails(mediaType, tmdbId);
  const values = {
    tmdbId,
    mediaType,
    title: d.title,
    originalTitle: d.originalTitle,
    year: d.year,
    releaseDate: d.releaseDate,
    posterPath: d.posterPath,
    backdropPath: d.backdropPath,
    overview: d.overview,
    runtime: d.runtime,
    genres: d.genres,
    countries: d.countries,
    originalLanguage: d.originalLanguage,
    imdbId: d.imdbId,
    voteAverage: d.voteAverage,
    seasons: d.seasons,
    collectionId: d.collection?.id ?? null,
    collectionName: d.collection?.name ?? null,
    collectionChecked: true,
    refreshedAt: new Date(),
  };
  const [row] = await db
    .insert(titles)
    .values(values)
    .onConflictDoUpdate({ target: [titles.tmdbId, titles.mediaType], set: values })
    .returning({ id: titles.id });

  type Role = "director" | "writer" | "creator" | "cast";
  const entries: { personId: number; name: string; profilePath: string | null; role: Role; character: string | null; order: number }[] = [];
  const seen = new Set<string>();
  const add = (p: { id: number; name: string; profilePath: string | null }, role: Role, order: number, character: string | null = null) => {
    const key = `${p.id}-${role}`;
    if (seen.has(key)) return;
    seen.add(key);
    entries.push({ personId: p.id, name: p.name, profilePath: p.profilePath, role, character, order });
  };
  d.directors.forEach((p, i) => add(p, "director", i));
  d.writers.slice(0, 6).forEach((p, i) => add(p, "writer", i));
  d.creators.forEach((p, i) => add(p, "creator", i));
  d.cast.slice(0, 15).forEach((p, i) => add(p, "cast", i, p.character));

  if (entries.length) {
    const uniquePeople = [...new Map(entries.map((e) => [e.personId, e])).values()];
    await db
      .insert(people)
      .values(uniquePeople.map((p) => ({ tmdbId: p.personId, name: p.name, profilePath: p.profilePath })))
      .onConflictDoUpdate({
        target: people.tmdbId,
        set: { name: sql`excluded.name`, profilePath: sql`excluded.profile_path` },
      });
  }
  await db.delete(credits).where(eq(credits.titleId, row.id));
  if (entries.length) {
    await db.insert(credits).values(
      entries.map((e) => ({ titleId: row.id, personId: e.personId, role: e.role, character: e.character, order: e.order })),
    );
  }
  return row.id;
}

let backfilling = false;

/** Titles cached before series info was stored: re-pull them (in the background) so actor stats can group series. */
export async function backfillCollections(db: DB, limit = 400) {
  if (backfilling) return { updated: 0 };
  backfilling = true;
  try {
    const pending = await db
      .select({ tmdbId: titles.tmdbId })
      .from(titles)
      .where(and(eq(titles.mediaType, "movie"), eq(titles.collectionChecked, false)))
      .limit(limit);
    let updated = 0;
    let next = 0;
    await Promise.all(
      Array.from({ length: 6 }, async () => {
        while (next < pending.length) {
          const { tmdbId } = pending[next++];
          try {
            await ensureTitle(db, tmdbId, "movie", { force: true });
            updated++;
          } catch {
            // Try again next time.
          }
        }
      }),
    );
    return { updated };
  } finally {
    backfilling = false;
  }
}

/**
 * How many saved movies haven't been checked for a film series yet (the Stats page fills those in, in the
 * background).
 */
export async function countUncheckedCollections(db: DB) {
  const rows = await db
    .select({ tmdbId: titles.tmdbId })
    .from(titles)
    .where(and(eq(titles.mediaType, "movie"), eq(titles.collectionChecked, false)));
  return rows.length;
}
