// Turns Letterboxd / TMDB export files into one common list of entries. Runs in the browser.
import { strFromU8, unzipSync } from "fflate";
import Papa from "papaparse";
import type { MediaType } from "./format";

export type ImportSource = "letterboxd" | "tmdb" | "plex" | "netflix";

export type ImportRow = {
  source: ImportSource;
  /** Stable id for this entry; stops the same entry being imported twice. */
  key: string;
  mediaType: MediaType;
  /** Known up front for TMDB exports; Letterboxd rows are matched by title + year. */
  tmdbId: number | null;
  title: string;
  year: number | null;
  watchedOn: string | null;
  /** TV only: which season the entry covers. */
  seasonNumber: number | null;
  rating: number | null;
  rewatch: boolean;
  liked: boolean;
  review: string | null;
  tags: string[];
  watchedWhere: string | null;
};

/** A season's worth of Netflix episodes; matched to TMDB on the server (needs a TV search + episode counts). */
export type NetflixSeason = { show: string; season: number; episodes: number; lastWatched: string };

export type ParseResult = { rows: ImportRow[]; notes: string[]; netflixSeasons?: NetflixSeason[] };

type CsvRow = Record<string, string>;

function parseCsv(text: string): { rows: CsvRow[]; headers: string[] } {
  const result = Papa.parse<CsvRow>(text.replace(/^﻿/, ""), { header: true, skipEmptyLines: true });
  return { rows: result.data, headers: result.meta.fields ?? [] };
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Case/spacing-insensitive column lookup, trying each alias in order. */
function pick(row: CsvRow, aliases: string[]): string {
  const wanted = aliases.map(norm);
  for (const alias of wanted) {
    for (const [key, value] of Object.entries(row)) {
      if (norm(key) === alias && value?.trim()) return value.trim();
    }
  }
  return "";
}

const hasColumn = (headers: string[], aliases: string[]) => headers.some((h) => aliases.map(norm).includes(norm(h)));

function toYear(value: string) {
  const match = value.match(/\d{4}/);
  return match ? Number(match[0]) : null;
}

function toDate(value: string) {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

const isYes = (value: string) => /^(yes|true|1|y)$/i.test(value);

const filmKey = (title: string, year: number | null) => `${title.toLowerCase().trim()}|${year ?? ""}`;

// ---------------------------------------------------------------------------
// Letterboxd
// ---------------------------------------------------------------------------

const LB = {
  name: ["Name", "Title", "Film"],
  year: ["Year"],
  uri: ["Letterboxd URI", "URI", "URL"],
  watched: ["Watched Date", "WatchedDate"],
  date: ["Date"],
  rating: ["Rating"],
  rewatch: ["Rewatch"],
  tags: ["Tags"],
  review: ["Review"],
};

type LetterboxdFiles = { diary?: CsvRow[]; reviews?: CsvRow[]; ratings?: CsvRow[]; likes?: CsvRow[] };

/** Letterboxd stars (0.5–5) → whole 1–10. Half stars map exactly. */
function starsToTen(value: string) {
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(10, Math.max(1, Math.round(n * 2)));
}

function parseLetterboxd(files: LetterboxdFiles): ParseResult {
  const notes: string[] = [];
  const rows: ImportRow[] = [];
  const reviews = files.reviews ?? [];
  const usedReviews = new Set<CsvRow>();
  const reviewByUri = new Map<string, CsvRow>();
  const reviewByEntry = new Map<string, CsvRow>();
  for (const r of reviews) {
    const uri = pick(r, LB.uri);
    if (uri) reviewByUri.set(uri, r);
    reviewByEntry.set(`${filmKey(pick(r, LB.name), toYear(pick(r, LB.year)))}|${pick(r, LB.watched)}`, r);
  }

  const toRow = (r: CsvRow, kind: string, review: CsvRow | undefined): ImportRow => {
    const title = pick(r, LB.name);
    const year = toYear(pick(r, LB.year));
    const watched = toDate(pick(r, LB.watched) || (kind === "rating" ? "" : pick(r, LB.date)));
    const uri = pick(r, LB.uri);
    const tags = pick(r, LB.tags) || (review ? pick(review, LB.tags) : "");
    return {
      source: "letterboxd",
      key: `lb:${kind}:${uri || `${filmKey(title, year)}|${watched ?? ""}`}`,
      mediaType: "movie",
      tmdbId: null,
      title,
      year,
      watchedOn: watched,
      seasonNumber: null,
      watchedWhere: null,
      rating: starsToTen(pick(r, LB.rating) || (review ? pick(review, LB.rating) : "")),
      rewatch: isYes(pick(r, LB.rewatch) || (review ? pick(review, LB.rewatch) : "")),
      liked: false,
      review: review ? pick(review, LB.review) || null : null,
      tags: tags
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
    };
  };

  for (const d of files.diary ?? []) {
    const uri = pick(d, LB.uri);
    const review =
      (uri && reviewByUri.get(uri)) ||
      reviewByEntry.get(`${filmKey(pick(d, LB.name), toYear(pick(d, LB.year)))}|${pick(d, LB.watched)}`);
    if (review) usedReviews.add(review);
    rows.push(toRow(d, "diary", review));
  }
  // Reviews that didn't line up with a diary entry still become entries.
  for (const r of reviews) if (!usedReviews.has(r)) rows.push(toRow(r, "review", r));

  // Ratings for films with no diary entry → "date unknown" entries.
  const logged = new Set(rows.map((r) => filmKey(r.title, r.year)));
  let ratingOnly = 0;
  for (const r of files.ratings ?? []) {
    if (logged.has(filmKey(pick(r, LB.name), toYear(pick(r, LB.year))))) continue;
    rows.push(toRow(r, "rating", undefined));
    ratingOnly++;
  }

  // Liked films: mark the most recent entry for each.
  const liked = new Set((files.likes ?? []).map((r) => filmKey(pick(r, LB.name), toYear(pick(r, LB.year)))));
  if (liked.size) {
    const latest = new Map<string, ImportRow>();
    for (const row of rows) {
      const k = filmKey(row.title, row.year);
      const current = latest.get(k);
      if (!current || (row.watchedOn ?? "") >= (current.watchedOn ?? "")) latest.set(k, row);
    }
    for (const [k, row] of latest) if (liked.has(k)) row.liked = true;
  }

  const diaryCount = files.diary?.length ?? 0;
  notes.push(
    `Letterboxd: ${diaryCount} diary entries, ${reviews.length} reviews` +
      (ratingOnly ? `, ${ratingOnly} ratings without a diary entry (imported as "date unknown")` : "") +
      (liked.size ? `, ${liked.size} liked films` : ""),
  );
  return { rows: rows.filter((r) => r.title), notes };
}

// ---------------------------------------------------------------------------
// TMDB
// ---------------------------------------------------------------------------

const TMDB = {
  id: ["TMDb ID", "TMDB ID", "tmdb_id", "tmdbId", "TMDb Id"],
  rating: ["Your Rating", "Rating", "My Rating", "Rating (out of 10)"],
  title: ["Name", "Title", "Original Title", "Original Name"],
  date: ["Release Date", "First Air Date", "Year", "Air Date"],
  type: ["Type", "Media Type", "Title Type"],
};

const isTmdbFile = (headers: string[]) => hasColumn(headers, TMDB.id);

function parseTmdb(rows: CsvRow[], headers: string[], fileName: string): ParseResult {
  const fileLooksTv = /\btv\b|show|series/i.test(fileName) || hasColumn(headers, ["First Air Date"]);
  const out: ImportRow[] = [];
  for (const r of rows) {
    const id = Number.parseInt(pick(r, TMDB.id), 10);
    const raw = Number.parseFloat(pick(r, TMDB.rating));
    if (!id || !Number.isFinite(raw) || raw <= 0) continue;
    const type = pick(r, TMDB.type).toLowerCase();
    const mediaType: MediaType = type ? (/tv|show|series/.test(type) ? "tv" : "movie") : fileLooksTv ? "tv" : "movie";
    out.push({
      source: "tmdb",
      key: `tmdb:${mediaType}:${id}`,
      mediaType,
      tmdbId: id,
      title: pick(r, TMDB.title) || `TMDB #${id}`,
      year: toYear(pick(r, TMDB.date)),
      // TMDB only knows when you rated it, not when you watched it.
      watchedOn: null,
      seasonNumber: null,
      watchedWhere: null,
      // Half points round up (7.5 → 8).
      rating: Math.min(10, Math.max(1, Math.round(raw))),
      rewatch: false,
      liked: false,
      review: null,
      tags: [],
    });
  }
  const shows = out.filter((r) => r.mediaType === "tv").length;
  const movies = out.length - shows;
  const parts = [movies && `${movies} movie rating${movies === 1 ? "" : "s"}`, shows && `${shows} TV rating${shows === 1 ? "" : "s"}`];
  return {
    rows: out,
    notes: [`TMDB (${fileName}): ${parts.filter(Boolean).join(", ") || "no ratings found"}`],
  };
}

// ---------------------------------------------------------------------------
// Netflix (Account → Profile → Viewing activity → Download all)
// ---------------------------------------------------------------------------

/** "Show: Season 2: Episode name", "Show: Limited Series: Episode name", "Show: Part 3: …", etc. */
const NETFLIX_EPISODE = /^(.+?): (?:(?:Season|Series|Volume|Part|Book|Collection) (\d+)|Limited Series|Miniseries|Mini-Series): (.+)$/i;

const isNetflixFile = (headers: string[]) => {
  const names = headers.map(norm);
  return names.includes("title") && names.includes("date") && !names.includes("name") && !names.includes("letterboxduri");
};

/** Netflix dates are M/D/YY in the US (D/M/YY elsewhere, detected when the first number is over 12). */
function netflixDate(value: string) {
  const m = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!m) return toDate(value);
  let [month, day] = [Number(m[1]), Number(m[2])];
  if (month > 12) [month, day] = [day, month];
  const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseNetflix(rows: CsvRow[]): ParseResult {
  const movies = new Map<string, { title: string; dates: Set<string> }>();
  const seasons = new Map<string, { show: string; season: number; episodes: Set<string>; last: string }>();
  let episodePlays = 0;
  for (const r of rows) {
    const title = pick(r, ["Title"]);
    const date = netflixDate(pick(r, ["Date"]));
    if (!title || !date) continue;
    const ep = title.match(NETFLIX_EPISODE);
    if (ep) {
      episodePlays++;
      const [, show, n, episode] = ep;
      const season = n ? Number(n) : 1;
      const key = `${show.toLowerCase()}|${season}`;
      const s = seasons.get(key) ?? { show, season, episodes: new Set<string>(), last: date };
      s.episodes.add(episode.toLowerCase());
      if (date > s.last) s.last = date;
      seasons.set(key, s);
    } else {
      const key = title.toLowerCase();
      const m = movies.get(key) ?? { title, dates: new Set<string>() };
      m.dates.add(date);
      movies.set(key, m);
    }
  }

  const out: ImportRow[] = [];
  for (const { title, dates } of movies.values()) {
    [...dates].sort().forEach((date, i) =>
      out.push({
        source: "netflix",
        key: `netflix:movie:${title.toLowerCase()}:${date}`,
        mediaType: "movie",
        tmdbId: null,
        title,
        year: null,
        watchedOn: date,
        seasonNumber: null,
        rating: null,
        rewatch: i > 0,
        liked: false,
        review: null,
        tags: [],
        watchedWhere: "Netflix",
      }),
    );
  }
  const shows = new Set([...seasons.values()].map((s) => s.show.toLowerCase())).size;
  return {
    rows: out,
    netflixSeasons: [...seasons.values()].map((s) => ({ show: s.show, season: s.season, episodes: s.episodes.size, lastWatched: s.last })),
    notes: [
      `Netflix: ${out.length.toLocaleString()} movie plays (anything that isn't an episode — specials and docs may need a look), ` +
        `${episodePlays.toLocaleString()} episode plays across ${shows.toLocaleString()} shows`,
    ],
  };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

function letterboxdKind(fileName: string): keyof LetterboxdFiles | null {
  const base = fileName.toLowerCase().split("/").pop() ?? "";
  if (fileName.toLowerCase().includes("likes/") && base === "films.csv") return "likes";
  if (fileName.includes("/") && !fileName.toLowerCase().startsWith("likes/")) return null; // lists/, deleted/, etc.
  if (base === "diary.csv") return "diary";
  if (base === "reviews.csv") return "reviews";
  if (base === "ratings.csv") return "ratings";
  return null;
}

/**
 * Reads whatever files you dropped (Letterboxd ZIP or CSVs, TMDB ratings CSV, Netflix viewing history, a backup)
 * and turns them into rows to review. Runs in the browser.
 */
export async function parseImportFiles(files: File[]): Promise<ParseResult> {
  const letterboxd: LetterboxdFiles = {};
  const results: ParseResult[] = [];
  const skipped: string[] = [];

  const handleCsv = (name: string, text: string) => {
    const { rows, headers } = parseCsv(text);
    if (isTmdbFile(headers)) {
      results.push(parseTmdb(rows, headers, name));
      return;
    }
    if (isNetflixFile(headers)) {
      results.push(parseNetflix(rows));
      return;
    }
    const kind = letterboxdKind(name);
    if (kind) letterboxd[kind] = [...(letterboxd[kind] ?? []), ...rows];
    else skipped.push(name);
  };

  for (const file of files) {
    if (file.name.toLowerCase().endsWith(".zip")) {
      const entries = unzipSync(new Uint8Array(await file.arrayBuffer()));
      for (const [name, data] of Object.entries(entries)) {
        if (!name.toLowerCase().endsWith(".csv")) continue;
        // Folders inside the zip can be nested under a top-level directory; strip it.
        const inner = name.replace(/^[^/]+\/(?=(diary|reviews|ratings|watched|watchlist|likes)\b)/i, "");
        const kind = letterboxdKind(inner);
        if (kind) letterboxd[kind] = [...(letterboxd[kind] ?? []), ...parseCsv(strFromU8(data)).rows];
      }
    } else {
      handleCsv(file.name, await file.text());
    }
  }

  if (letterboxd.diary || letterboxd.reviews || letterboxd.ratings) results.push(parseLetterboxd(letterboxd));
  const notes = results.flatMap((r) => r.notes);
  if (skipped.length) notes.push(`Ignored: ${skipped.join(", ")} (not a Letterboxd, TMDB, or Netflix file)`);
  return { rows: results.flatMap((r) => r.rows), notes, netflixSeasons: results.flatMap((r) => r.netflixSeasons ?? []) };
}

/**
 * Which new rows should fill in the date on an existing "date unknown" entry:
 * the earliest dated movie play for each title that has one.
 */
export function pickDateFills<T extends { key: string; mediaType: MediaType; tmdbId: number | null; watchedOn: string | null; seasonNumber: number | null }>(
  rows: T[],
  statuses: Record<string, string>,
  undated: string[],
) {
  const undatedSet = new Set(undated);
  const earliest = new Map<string, T>();
  for (const r of rows) {
    if (!r.watchedOn || r.seasonNumber !== null || r.tmdbId === null || statuses[r.key] !== "new") continue;
    const k = `${r.mediaType}-${r.tmdbId}`;
    if (!undatedSet.has(k)) continue;
    const current = earliest.get(k);
    if (!current || r.watchedOn < current.watchedOn!) earliest.set(k, r);
  }
  return new Set([...earliest.values()].map((r) => r.key));
}
