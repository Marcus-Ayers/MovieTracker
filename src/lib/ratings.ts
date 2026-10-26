import "server-only";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { apiUsage, externalRatings, getDb, imdbRatings, jobRuns, titles, type DB } from "@/db";

/**
 * Where scores come from:
 * - IMDb rating: IMDb's free daily ratings file (every title with 1,000+ votes). No API calls.
 * - Rotten Tomatoes / Metacritic: OMDb (1,000 calls/day free). Each title is fetched once and saved.
 *   Films more than a year old are never fetched again; this year's and last year's are refreshed
 *   occasionally because their scores still move.
 * - A nightly job backfills OMDb scores: library/watchlist titles first, then the most-voted films on IMDb.
 */

export type ExternalRatings = { imdb: string | null; rottenTomatoes: string | null; metacritic: string | null };

const OMDB_DAILY_LIMIT = 1000;
/** The nightly backfill stops here, leaving the rest of the day's quota for brand-new titles people look at. */
const BACKFILL_BUDGET = 900;
const IMDB_DATASET = "https://datasets.imdbws.com/title.ratings.tsv.gz";
const IMDB_MIN_VOTES = 1000;
const DAY = 24 * 60 * 60 * 1000;

const today = () => new Date().toISOString().slice(0, 10);
const clean = (value: string | undefined | null) => (value && value !== "N/A" ? value : null);

/** Recent releases' scores still change; older films' are effectively final. */
function isStale(row: { year: number | null; fetchedAt: Date }) {
  const age = Date.now() - row.fetchedAt.getTime();
  const thisYear = new Date().getUTCFullYear();
  if (row.year === null) return age > 90 * DAY; // unknown year: check again rarely
  if (row.year >= thisYear) return age > 7 * DAY;
  if (row.year === thisYear - 1) return age > 30 * DAY;
  return false;
}

// ---------------------------------------------------------------------------
// OMDb
// ---------------------------------------------------------------------------

async function omdbCallsToday(db: DB) {
  const [row] = await db
    .select({ calls: apiUsage.calls })
    .from(apiUsage)
    .where(and(eq(apiUsage.day, today()), eq(apiUsage.service, "omdb")));
  return row?.calls ?? 0;
}

async function countOmdbCall(db: DB) {
  await db
    .insert(apiUsage)
    .values({ day: today(), service: "omdb", calls: 1 })
    .onConflictDoUpdate({ target: [apiUsage.day, apiUsage.service], set: { calls: sql`${apiUsage.calls} + 1` } });
}

type OmdbResult = (ExternalRatings & { year: number | null }) | "missing" | "limit" | null;

async function fetchOmdb(db: DB, imdbId: string, key: string): Promise<OmdbResult> {
  try {
    await countOmdbCall(db);
    const res = await fetch(`https://www.omdbapi.com/?i=${encodeURIComponent(imdbId)}&apikey=${encodeURIComponent(key)}`);
    if (res.status === 401) return "limit";
    if (!res.ok) return null;
    const data = (await res.json()) as {
      Response?: string;
      Error?: string;
      Year?: string;
      imdbRating?: string;
      Ratings?: { Source: string; Value: string }[];
    };
    if (data.Response === "False") {
      if (/limit/i.test(data.Error ?? "")) return "limit";
      return /not found|incorrect imdb/i.test(data.Error ?? "") ? "missing" : null;
    }
    const find = (source: string) => clean(data.Ratings?.find((r) => r.Source === source)?.Value);
    const year = Number.parseInt(data.Year ?? "", 10);
    return {
      imdb: clean(data.imdbRating),
      rottenTomatoes: find("Rotten Tomatoes"),
      metacritic: find("Metacritic"),
      year: Number.isFinite(year) ? year : null,
    };
  } catch {
    return null;
  }
}

async function saveOmdb(db: DB, imdbId: string, result: Exclude<OmdbResult, "limit" | null>) {
  const values =
    result === "missing" ? { imdb: null, rottenTomatoes: null, metacritic: null, year: null } : result;
  await db
    .insert(externalRatings)
    .values({ imdbId, ...values, fetchedAt: new Date() })
    .onConflictDoUpdate({ target: externalRatings.imdbId, set: { ...values, fetchedAt: new Date() } });
  return values;
}

const inFlight = new Map<string, Promise<void>>();

/** IMDb + Rotten Tomatoes + Metacritic for one title. Uses saved data; only calls OMDb for titles it has never seen. */
export async function getExternalRatings(imdbId: string | null): Promise<ExternalRatings | null> {
  if (!imdbId) return null;
  const db = await getDb();
  const read = async () => {
    const [[saved], [fromImdb]] = await Promise.all([
      db.select().from(externalRatings).where(eq(externalRatings.imdbId, imdbId)),
      db.select().from(imdbRatings).where(eq(imdbRatings.tconst, imdbId)),
    ]);
    return { saved, fromImdb };
  };
  let { saved, fromImdb } = await read();

  const key = process.env.OMDB_API_KEY?.trim();
  if (key && (!saved || isStale(saved)) && (await omdbCallsToday(db)) < OMDB_DAILY_LIMIT) {
    let pending = inFlight.get(imdbId);
    if (!pending) {
      pending = (async () => {
        const result = await fetchOmdb(db, imdbId, key);
        if (result !== null && result !== "limit") await saveOmdb(db, imdbId, result);
      })().finally(() => inFlight.delete(imdbId));
      inFlight.set(imdbId, pending);
    }
    await pending;
    ({ saved, fromImdb } = await read());
  }

  if (!saved && !fromImdb) return null;
  return {
    // IMDb's own file is updated daily, so prefer it over OMDb's copy.
    imdb: fromImdb ? fromImdb.rating.toFixed(1) : (saved?.imdb ?? null),
    rottenTomatoes: saved?.rottenTomatoes ?? null,
    metacritic: saved?.metacritic ?? null,
  };
}

// ---------------------------------------------------------------------------
// Background jobs
// ---------------------------------------------------------------------------

async function recordRun(db: DB, name: string, summary: string) {
  await db
    .insert(jobRuns)
    .values({ name, lastRunAt: new Date(), summary })
    .onConflictDoUpdate({ target: jobRuns.name, set: { lastRunAt: new Date(), summary } });
}

/** Downloads IMDb's daily ratings file and stores every title with 1,000+ votes. Skips if it ran in the last 20 hours. */
export async function syncImdbRatings(db: DB, { force = false } = {}) {
  const [last] = await db.select().from(jobRuns).where(eq(jobRuns.name, "imdb-ratings"));
  if (!force && last && Date.now() - last.lastRunAt.getTime() < 20 * 60 * 60 * 1000) {
    return { skipped: true, stored: 0 };
  }

  const res = await fetch(IMDB_DATASET);
  if (!res.ok || !res.body) throw new Error(`IMDb dataset download failed (${res.status})`);
  const text = res.body.pipeThrough(new DecompressionStream("gzip")).pipeThrough(new TextDecoderStream());

  const rows: { tconst: string; rating: number; votes: number }[] = [];
  let carry = "";
  for await (const chunk of text as unknown as AsyncIterable<string>) {
    const lines = (carry + chunk).split("\n");
    carry = lines.pop() ?? "";
    for (const line of lines) {
      const [tconst, rating, votes] = line.split("\t");
      const v = Number(votes);
      if (tconst?.startsWith("tt") && v >= IMDB_MIN_VOTES) rows.push({ tconst, rating: Number(rating), votes: v });
    }
  }

  for (let i = 0; i < rows.length; i += 5000) {
    await db
      .insert(imdbRatings)
      .values(rows.slice(i, i + 5000))
      .onConflictDoUpdate({ target: imdbRatings.tconst, set: { rating: sql`excluded.rating`, votes: sql`excluded.votes` } });
  }
  await recordRun(db, "imdb-ratings", `${rows.length.toLocaleString()} titles`);
  return { skipped: false, stored: rows.length };
}

/**
 * Fills in Rotten Tomatoes / Metacritic scores using what's left of today's OMDb budget.
 * Order: titles anyone has logged or watchlisted, then the most-voted titles on IMDb.
 */
export async function backfillRatings(db: DB, { budget = BACKFILL_BUDGET } = {}) {
  const key = process.env.OMDB_API_KEY?.trim();
  if (!key) return { fetched: 0, remaining: null as number | null, reason: "No OMDB_API_KEY set" };
  const allowance = Math.max(0, budget - (await omdbCallsToday(db)));
  if (!allowance) return { fetched: 0, remaining: null, reason: "Today's OMDb budget is used up" };

  // 1. Titles in the database (anything logged or watchlisted) that are missing or stale.
  const known = await db
    .select({ imdbId: titles.imdbId, year: externalRatings.year, fetchedAt: externalRatings.fetchedAt })
    .from(titles)
    .leftJoin(externalRatings, eq(externalRatings.imdbId, titles.imdbId))
    .where(isNotNull(titles.imdbId));
  const queue = [
    ...new Set(
      known.filter((k) => !k.fetchedAt || isStale({ year: k.year, fetchedAt: k.fetchedAt })).map((k) => k.imdbId!),
    ),
  ];

  // 2. Then the most popular titles on IMDb that have never been fetched.
  if (queue.length < allowance) {
    const popular = await db
      .select({ tconst: imdbRatings.tconst })
      .from(imdbRatings)
      .where(sql`not exists (select 1 from ${externalRatings} where ${externalRatings.imdbId} = ${imdbRatings.tconst})`)
      .orderBy(sql`${imdbRatings.votes} desc`)
      .limit(allowance - queue.length + 50);
    const queued = new Set(queue);
    for (const p of popular) if (!queued.has(p.tconst)) queue.push(p.tconst);
  }

  const batch = queue.slice(0, allowance);
  let fetched = 0;
  let hitLimit = false;
  let next = 0;
  await Promise.all(
    Array.from({ length: 5 }, async () => {
      while (next < batch.length && !hitLimit) {
        const imdbId = batch[next++];
        const result = await fetchOmdb(db, imdbId, key);
        if (result === "limit") hitLimit = true;
        else if (result !== null) {
          await saveOmdb(db, imdbId, result);
          fetched++;
        }
      }
    }),
  );
  await recordRun(db, "omdb-backfill", `${fetched} fetched${hitLimit ? " (hit OMDb's daily limit)" : ""}`);
  return { fetched, remaining: Math.max(0, queue.length - batch.length), reason: hitLimit ? "Hit OMDb's daily limit" : null };
}

export type RatingsStatus = {
  imdbTitles: number;
  imdbSyncedAt: Date | null;
  omdbScores: number;
  omdbCallsToday: number;
  omdbLimit: number;
  backfillRanAt: Date | null;
  libraryTitles: number;
  libraryWithImdb: number;
  /** Library titles OMDb has been asked about (some films simply have no RT score). */
  libraryRtChecked: number;
  hasOmdbKey: boolean;
};

/** Numbers for the Settings page. */
export async function getRatingsStatus(userId: number): Promise<RatingsStatus> {
  const db = await getDb();
  const [[imdbCount], [omdbCount], runs, calls, [library]] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(imdbRatings),
    db.select({ n: sql<number>`count(*)::int` }).from(externalRatings),
    db.select().from(jobRuns),
    omdbCallsToday(db),
    db.execute<{ total: number; imdb: number; checked: number }>(sql`
      select count(distinct t.id)::int as total,
             count(distinct t.id) filter (where i.tconst is not null or e.imdb is not null)::int as imdb,
             count(distinct t.id) filter (where e.imdb_id is not null)::int as checked
      from titles t
      left join external_ratings e on e.imdb_id = t.imdb_id
      left join imdb_ratings i on i.tconst = t.imdb_id
      where t.id in (select title_id from viewings where user_id = ${userId}
                     union select title_id from user_titles where user_id = ${userId})
    `).then((r) => r.rows),
  ]);
  const run = (name: string) => runs.find((r) => r.name === name)?.lastRunAt ?? null;
  return {
    imdbTitles: imdbCount.n,
    imdbSyncedAt: run("imdb-ratings"),
    omdbScores: omdbCount.n,
    omdbCallsToday: calls,
    omdbLimit: OMDB_DAILY_LIMIT,
    backfillRanAt: run("omdb-backfill"),
    libraryTitles: library?.total ?? 0,
    libraryWithImdb: library?.imdb ?? 0,
    libraryRtChecked: library?.checked ?? 0,
    hasOmdbKey: Boolean(process.env.OMDB_API_KEY?.trim()),
  };
}
