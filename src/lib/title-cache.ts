import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { credits, people, titles, type DB } from "@/db";
import type { MediaType } from "./format";
import { getTitleDetails } from "./tmdb";

// TMDB's terms allow caching for up to 6 months; refresh well before that.
const REFRESH_AFTER_MS = 90 * 24 * 60 * 60 * 1000;

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
