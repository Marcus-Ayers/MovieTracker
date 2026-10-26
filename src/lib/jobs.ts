import "server-only";
import { getDb } from "@/db";
import { syncAllPlex } from "./plex";
import { backfillRatings, syncImdbRatings } from "./ratings";
import { refreshStaleTitles } from "./title-cache";

/**
 * The nightly maintenance run (Vercel cron → /api/cron/daily, or "Update now" in Settings):
 * 1. Pull IMDb's daily ratings file.
 * 2. Spend the day's OMDb budget backfilling Rotten Tomatoes scores.
 * 3. Re-pull TMDB data for titles cached more than 90 days ago.
 * 4. Sync new Plex plays for anyone who connected Plex.
 */
export async function runDailyJobs({ force = false } = {}) {
  const db = await getDb();
  const errors: string[] = [];
  const imdb = await syncImdbRatings(db, { force }).catch((e: Error) => {
    errors.push(e.message);
    return null;
  });
  const ratings = await backfillRatings(db);
  const titles = await refreshStaleTitles(db);
  const plex = await syncAllPlex(db);
  return { imdb, ratings, titles, plex, errors };
}
