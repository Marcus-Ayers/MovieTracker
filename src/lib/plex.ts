import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { plexConnections, plexItems, type DB } from "@/db";
import { plural, type MediaType } from "./format";
import { getImportStatuses, saveImportRows, type SaveRow } from "./import-save";
import { pickDateFills, type ImportRow } from "./import-parse";
import { findByExternalId, getTvDetails } from "./tmdb";

/**
 * Plex integration.
 * - Sign-in uses Plex's PIN flow: we create a PIN, you approve it on app.plex.tv, Plex hands us a token.
 * - Your servers (and how to reach them: local network, remote, or Plex relay) come from plex.tv.
 * - Watch history comes from the server's /status/sessions/history/all, filtered to one account.
 * - Each library item's TMDB id comes from its Plex GUIDs (tmdb://, imdb://, tvdb://), cached in plex_items.
 */

const PRODUCT = "MovieTracker";
const PLEX_TV = "https://plex.tv/api/v2";

export type PlexConnection = typeof plexConnections.$inferSelect;
type ServerConn = { uri: string; token: string; clientId: string };

function headers(clientId: string, token?: string | null): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/json",
    "X-Plex-Product": PRODUCT,
    "X-Plex-Version": "1.0",
    "X-Plex-Client-Identifier": clientId,
  };
  if (token) h["X-Plex-Token"] = token;
  return h;
}

export async function getPlexConnection(db: DB, userId: number) {
  const [row] = await db.select().from(plexConnections).where(eq(plexConnections.userId, userId));
  return row ?? null;
}

export async function getOrCreatePlexConnection(db: DB, userId: number) {
  const existing = await getPlexConnection(db, userId);
  if (existing) return existing;
  const [row] = await db.insert(plexConnections).values({ userId, clientId: randomUUID() }).returning();
  return row;
}

// ---------------------------------------------------------------------------
// Sign-in (PIN flow)
// ---------------------------------------------------------------------------

export async function createPin(clientId: string) {
  const res = await fetch(`${PLEX_TV}/pins?strong=true`, { method: "POST", headers: headers(clientId) });
  if (!res.ok) throw new Error(`Plex sign-in failed to start (${res.status})`);
  return (await res.json()) as { id: number; code: string };
}

export function plexAuthUrl(clientId: string, code: string, forwardUrl: string) {
  const params = new URLSearchParams({ clientID: clientId, code, forwardUrl, "context[device][product]": PRODUCT });
  return `https://app.plex.tv/auth#?${params.toString()}`;
}

/** The user's token once they've approved the PIN; null while waiting. */
export async function checkPin(clientId: string, pinId: number): Promise<string | null> {
  const res = await fetch(`${PLEX_TV}/pins/${pinId}`, { headers: headers(clientId) });
  if (!res.ok) return null;
  const data = (await res.json()) as { authToken?: string | null };
  return data.authToken || null;
}

// ---------------------------------------------------------------------------
// Servers
// ---------------------------------------------------------------------------

export type PlexServer = {
  name: string;
  id: string;
  owned: boolean;
  accessToken: string;
  connections: { uri: string; local: boolean; relay: boolean }[];
};

export async function listServers(clientId: string, token: string): Promise<PlexServer[]> {
  const res = await fetch(`${PLEX_TV}/resources?includeHttps=1&includeRelay=1`, { headers: headers(clientId, token) });
  if (!res.ok) throw new Error(`Couldn't list your Plex servers (${res.status})`);
  const data = (await res.json()) as {
    name: string;
    clientIdentifier: string;
    provides: string;
    owned: boolean;
    accessToken?: string;
    connections?: { uri: string; local: boolean; relay: boolean }[];
  }[];
  return data
    .filter((r) => r.provides.split(",").includes("server"))
    .map((r) => ({
      name: r.name,
      id: r.clientIdentifier,
      owned: r.owned,
      accessToken: r.accessToken ?? token,
      connections: r.connections ?? [],
    }));
}

/** The first connection that answers: local network first, then remote, then Plex's relay. */
export async function pickConnection(server: PlexServer, clientId: string): Promise<string | null> {
  const rank = (c: { local: boolean; relay: boolean }) => (c.relay ? 2 : c.local ? 0 : 1);
  for (const c of [...server.connections].sort((a, b) => rank(a) - rank(b))) {
    try {
      const res = await fetch(`${c.uri}/identity`, { headers: headers(clientId, server.accessToken), signal: AbortSignal.timeout(4000) });
      if (res.ok) return c.uri;
    } catch {
      // Unreachable from here; try the next one.
    }
  }
  return null;
}

async function pms<T>(conn: ServerConn, path: string, extraHeaders: Record<string, string> = {}): Promise<T> {
  const res = await fetch(`${conn.uri}${path}`, {
    headers: { ...headers(conn.clientId, conn.token), ...extraHeaders },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Plex server request failed (${res.status}) for ${path.split("?")[0]}`);
  return (await res.json()) as T;
}

export function serverConn(c: PlexConnection): ServerConn | null {
  return c.serverUri && c.serverToken ? { uri: c.serverUri, token: c.serverToken, clientId: c.clientId } : null;
}

/** People with their own watch history on the server (Plex Home / shared users). The owner is id 1. */
export async function getAccounts(conn: ServerConn) {
  const data = await pms<{ MediaContainer: { Account?: { id: number; name: string }[] } }>(conn, "/accounts");
  return (data.MediaContainer.Account ?? []).filter((a) => a.id > 0 && a.name);
}

// ---------------------------------------------------------------------------
// History → diary rows
// ---------------------------------------------------------------------------

type HistoryEntry = {
  ratingKey?: string;
  key?: string;
  grandparentKey?: string;
  grandparentRatingKey?: string;
  type: string;
  title: string;
  grandparentTitle?: string;
  parentIndex?: number;
  index?: number;
  viewedAt: number;
  originallyAvailableAt?: string;
  accountID?: number;
};

const keyFrom = (path: string | undefined) => path?.split("/").pop() ?? undefined;

export async function fetchHistory(conn: ServerConn, accountId: number): Promise<HistoryEntry[]> {
  const out: HistoryEntry[] = [];
  const size = 500;
  for (let start = 0; start < 50_000; start += size) {
    const data = await pms<{ MediaContainer: { totalSize?: number; size?: number; Metadata?: HistoryEntry[] } }>(
      conn,
      `/status/sessions/history/all?sort=viewedAt:desc&accountID=${accountId}`,
      { "X-Plex-Container-Start": String(start), "X-Plex-Container-Size": String(size) },
    );
    const page = data.MediaContainer.Metadata ?? [];
    // Older servers ignore the accountID filter; filter here too.
    out.push(...page.filter((e) => e.accountID === undefined || e.accountID === accountId));
    const total = data.MediaContainer.totalSize ?? 0;
    if (!page.length || start + page.length >= total) break;
  }
  return out;
}

type ResolvedItem = { tmdbId: number | null; mediaType: MediaType | null; title: string | null; year: number | null };

type PlexMetadata = {
  ratingKey: string;
  type: string;
  title: string;
  year?: number;
  guid?: string;
  Guid?: { id: string }[];
};

/** Plex GUIDs → TMDB id. Handles the current agents (tmdb://, imdb://, tvdb://) and the legacy ones. */
async function tmdbFromGuids(m: PlexMetadata): Promise<{ tmdbId: number; mediaType: MediaType } | null> {
  const mediaType: MediaType = m.type === "movie" ? "movie" : "tv";
  const ids = [...(m.Guid ?? []).map((g) => g.id), m.guid ?? ""];
  for (const id of ids) {
    const tmdb = id.match(/^(?:tmdb|com\.plexapp\.agents\.themoviedb):\/\/(\d+)/);
    if (tmdb) return { tmdbId: Number(tmdb[1]), mediaType };
  }
  for (const id of ids) {
    const imdb = id.match(/^(?:imdb|com\.plexapp\.agents\.imdb):\/\/(tt\d+)/);
    if (imdb) {
      const found = await findByExternalId(imdb[1], "imdb_id");
      if (found) return found;
    }
    const tvdb = id.match(/^(?:tvdb|com\.plexapp\.agents\.thetvdb):\/\/(\d+)/);
    if (tvdb) {
      const found = await findByExternalId(tvdb[1], "tvdb_id");
      if (found) return found;
    }
  }
  return null;
}

/** ratingKey → TMDB id for every item, using the cache where possible. Deleted items resolve to null. */
async function resolveItems(db: DB, conn: ServerConn, serverId: string, ratingKeys: string[]) {
  const unique = [...new Set(ratingKeys)];
  const resolved = new Map<string, ResolvedItem>();
  for (let i = 0; i < unique.length; i += 500) {
    const cached = await db
      .select()
      .from(plexItems)
      .where(and(eq(plexItems.serverId, serverId), inArray(plexItems.ratingKey, unique.slice(i, i + 500))));
    for (const c of cached) resolved.set(c.ratingKey, c);
  }

  const missing = unique.filter((k) => !resolved.has(k));
  for (let i = 0; i < missing.length; i += 40) {
    const batch = missing.slice(i, i + 40);
    let items: PlexMetadata[] = [];
    try {
      const data = await pms<{ MediaContainer: { Metadata?: PlexMetadata[] } }>(conn, `/library/metadata/${batch.join(",")}?includeGuids=1`);
      items = data.MediaContainer.Metadata ?? [];
    } catch {
      // A batch with a deleted item can fail as a whole; fall back to one at a time.
      for (const key of batch) {
        try {
          const data = await pms<{ MediaContainer: { Metadata?: PlexMetadata[] } }>(conn, `/library/metadata/${key}?includeGuids=1`);
          items.push(...(data.MediaContainer.Metadata ?? []));
        } catch {
          // Deleted from the library.
        }
      }
    }
    const byKey = new Map(items.map((m) => [String(m.ratingKey), m]));
    const rows = await Promise.all(
      batch.map(async (key) => {
        const m = byKey.get(key);
        const found = m ? await tmdbFromGuids(m) : null;
        const value: ResolvedItem = {
          tmdbId: found?.tmdbId ?? null,
          mediaType: found?.mediaType ?? (m ? (m.type === "movie" ? "movie" : "tv") : null),
          title: m?.title ?? null,
          year: m?.year ?? null,
        };
        resolved.set(key, value);
        return { serverId, ratingKey: key, ...value };
      }),
    );
    if (rows.length) await db.insert(plexItems).values(rows).onConflictDoNothing();
  }
  return resolved;
}

function dateIn(timeZone: string, unixSeconds: number) {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(unixSeconds * 1000));
}

/**
 * Turns Plex history into diary rows:
 * - Movies: one entry per movie per day you played it; later plays are rewatches.
 * - TV: one entry per *completed* season, dated when you watched its last episode.
 */
export async function buildPlexRows(db: DB, c: PlexConnection): Promise<{ rows: ImportRow[]; notes: string[] }> {
  const conn = serverConn(c);
  if (!conn || !c.serverId || c.accountId === null) throw new Error("Plex isn't fully connected yet.");
  const history = await fetchHistory(conn, c.accountId);
  const movies = history.filter((h) => h.type === "movie" && h.ratingKey);
  const episodes = history.filter((h) => h.type === "episode");
  const showKey = (e: HistoryEntry) => e.grandparentRatingKey ?? keyFrom(e.grandparentKey);

  const resolved = await resolveItems(db, conn, c.serverId, [
    ...movies.map((m) => m.ratingKey!),
    ...episodes.map(showKey).filter((k): k is string => Boolean(k)),
  ]);

  const rows: ImportRow[] = [];

  // Movies
  const byMovie = new Map<string, { entry: HistoryEntry; item: ResolvedItem | undefined; dates: Set<string> }>();
  for (const m of movies) {
    const item = resolved.get(m.ratingKey!);
    const id = item?.tmdbId ? `tmdb-${item.tmdbId}` : `rk-${m.ratingKey}`;
    const group = byMovie.get(id) ?? { entry: m, item, dates: new Set<string>() };
    group.dates.add(dateIn(c.timeZone, m.viewedAt));
    byMovie.set(id, group);
  }
  for (const { entry, item, dates } of byMovie.values()) {
    const tmdbId = item?.tmdbId && item.mediaType === "movie" ? item.tmdbId : null;
    [...dates].sort().forEach((date, i) => {
      rows.push({
        source: "plex",
        key: `plex:movie:${tmdbId ?? `rk${entry.ratingKey}`}:${date}`,
        mediaType: "movie",
        tmdbId,
        title: item?.title ?? entry.title,
        year: item?.year ?? (entry.originallyAvailableAt ? Number(entry.originallyAvailableAt.slice(0, 4)) : null),
        watchedOn: date,
        seasonNumber: null,
        rating: null,
        rewatch: i > 0,
        liked: false,
        review: null,
        tags: [],
        watchedWhere: "Plex",
      });
    });
  }

  // TV: completed seasons only
  const seasons = new Map<string, { show: string; season: number; episodes: Set<number>; last: number }>();
  for (const e of episodes) {
    const show = showKey(e);
    if (!show || e.parentIndex === undefined || e.index === undefined) continue;
    const k = `${show}:${e.parentIndex}`;
    const s = seasons.get(k) ?? { show, season: e.parentIndex, episodes: new Set<number>(), last: 0 };
    s.episodes.add(e.index);
    s.last = Math.max(s.last, e.viewedAt);
    seasons.set(k, s);
  }
  let completed = 0;
  let inProgress = 0;
  let unmatchedShows = 0;
  for (const s of seasons.values()) {
    const item = resolved.get(s.show);
    if (!item?.tmdbId || item.mediaType !== "tv") {
      unmatchedShows++;
      continue;
    }
    const details = await getTvDetails(item.tmdbId).catch(() => null);
    const episodeCount = details?.seasons.find((x) => x.number === s.season)?.episodeCount ?? 0;
    if (!episodeCount || s.episodes.size < episodeCount) {
      inProgress++;
      continue;
    }
    completed++;
    rows.push({
      source: "plex",
      key: `plex:tv:${item.tmdbId}:s${s.season}`,
      mediaType: "tv",
      tmdbId: item.tmdbId,
      title: details?.title ?? item.title ?? "Unknown show",
      year: details?.year ?? item.year,
      watchedOn: dateIn(c.timeZone, s.last),
      seasonNumber: s.season,
      rating: null,
      rewatch: false,
      liked: false,
      review: null,
      tags: [],
      watchedWhere: "Plex",
    });
  }

  const oldest = history.length ? dateIn(c.timeZone, Math.min(...history.map((h) => h.viewedAt))) : null;
  const notes = [
    `Plex (${c.serverName ?? "server"}, ${c.accountName ?? "account"}): ${movies.length.toLocaleString()} movie plays of ${byMovie.size.toLocaleString()} movies` +
      (oldest ? ` · history goes back to ${oldest}` : ""),
    `TV: ${plural(completed, "completed season")} from ${plural(episodes.length, "episode play")}` +
      (inProgress ? ` · ${plural(inProgress, "season")} not finished yet (logged once you finish)` : "") +
      (unmatchedShows ? ` · ${plural(unmatchedShows, "season")} from shows Plex couldn't identify` : ""),
  ];
  return { rows, notes };
}

/** Pulls Plex history and saves anything new — no review step. Used by "Sync now" and the nightly job. */
export async function syncPlex(db: DB, userId: number) {
  const c = await getPlexConnection(db, userId);
  if (!c || !serverConn(c) || c.accountId === null) return null;
  const { rows } = await buildPlexRows(db, c);
  const usable = rows.filter((r): r is ImportRow & { tmdbId: number } => r.tmdbId !== null);
  const { statuses, undated } = await getImportStatuses(db, userId, usable);
  const fills = pickDateFills(usable, statuses, undated);
  const toSave: SaveRow[] = usable
    .filter((r) => statuses[r.key] === "new")
    .map((r) => ({ ...r, fillUndated: fills.has(r.key) }));
  const result = await saveImportRows(db, userId, toSave);
  const summary =
    [
      result.imported && `${result.imported} new ${result.imported === 1 ? "entry" : "entries"}`,
      result.datesFilled && `${result.datesFilled} dates filled in`,
    ]
      .filter(Boolean)
      .join(", ") || "Nothing new";
  await db.update(plexConnections).set({ lastSyncedAt: new Date(), lastSyncSummary: summary }).where(eq(plexConnections.userId, userId));
  return { ...result, summary };
}

/** Nightly: sync everyone who has connected Plex. */
export async function syncAllPlex(db: DB) {
  const all = await db.select({ userId: plexConnections.userId }).from(plexConnections);
  const results: string[] = [];
  for (const { userId } of all) {
    try {
      const r = await syncPlex(db, userId);
      if (r) results.push(r.summary);
    } catch (e) {
      results.push(`Plex sync failed: ${(e as Error).message}`);
    }
  }
  return results;
}
