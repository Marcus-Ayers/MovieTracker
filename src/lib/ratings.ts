import "server-only";
import { eq } from "drizzle-orm";
import { externalRatings, getDb } from "@/db";

export type ExternalRatings = { imdb: string | null; rottenTomatoes: string | null; metacritic: string | null };

const REFRESH_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
const inFlight = new Map<string, Promise<ExternalRatings | null>>();

const clean = (value: string | undefined | null) => (value && value !== "N/A" ? value : null);

/** Fetches from OMDb. Returns "missing" when OMDb doesn't know the title, null on errors (incl. the daily limit). */
async function fetchOmdb(imdbId: string, key: string): Promise<ExternalRatings | "missing" | null> {
  try {
    const res = await fetch(`https://www.omdbapi.com/?i=${encodeURIComponent(imdbId)}&apikey=${encodeURIComponent(key)}`);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      Response?: string;
      Error?: string;
      imdbRating?: string;
      Ratings?: { Source: string; Value: string }[];
    };
    if (data.Response === "False") return /not found|incorrect imdb/i.test(data.Error ?? "") ? "missing" : null;
    const find = (source: string) => clean(data.Ratings?.find((r) => r.Source === source)?.Value);
    return { imdb: clean(data.imdbRating), rottenTomatoes: find("Rotten Tomatoes"), metacritic: find("Metacritic") };
  } catch {
    return null;
  }
}

/**
 * IMDb / Rotten Tomatoes / Metacritic for a title. Saved in the database for a week,
 * so the OMDb free tier (1,000 requests/day) goes a long way. Returns null without an OMDb key.
 */
export async function getExternalRatings(imdbId: string | null): Promise<ExternalRatings | null> {
  const key = process.env.OMDB_API_KEY?.trim();
  if (!key || !imdbId) return null;

  const db = await getDb();
  const [saved] = await db.select().from(externalRatings).where(eq(externalRatings.imdbId, imdbId));
  const savedRatings = saved ? { imdb: saved.imdb, rottenTomatoes: saved.rottenTomatoes, metacritic: saved.metacritic } : null;
  if (saved && Date.now() - saved.fetchedAt.getTime() < REFRESH_AFTER_MS) return savedRatings;

  let pending = inFlight.get(imdbId);
  if (!pending) {
    pending = (async () => {
      const fresh = await fetchOmdb(imdbId, key);
      if (fresh === null) return savedRatings; // OMDb hiccup or quota hit: keep what we had.
      const values = fresh === "missing" ? { imdb: null, rottenTomatoes: null, metacritic: null } : fresh;
      await db
        .insert(externalRatings)
        .values({ imdbId, ...values, fetchedAt: new Date() })
        .onConflictDoUpdate({ target: externalRatings.imdbId, set: { ...values, fetchedAt: new Date() } });
      return values;
    })().finally(() => inFlight.delete(imdbId));
    inFlight.set(imdbId, pending);
  }
  return pending;
}
