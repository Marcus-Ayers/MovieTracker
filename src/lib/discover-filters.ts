// Movies / TV filter state ⇄ URL. Shared by the server (to query TMDB) and the sidebar (to edit it).
import type { MediaType } from "./format";

export type DiscoverFilters = {
  media: MediaType;
  sort: string;
  genres: number[];
  excludeGenres: number[];
  from: number | null;
  to: number | null;
  scoreMin: number;
  scoreMax: number;
  minVotes: number;
  runtimeMin: number;
  runtimeMax: number;
  providers: number[];
  monetization: string[];
  language: string;
  certifications: string[];
  keywords: number[];
  people: number[];
  hideSeen: boolean;
  view: "grid" | "list";
};

export const SORTS: Record<MediaType, { value: string; label: string }[]> = {
  movie: [
    { value: "popularity.desc", label: "Most popular" },
    { value: "vote_average.desc", label: "Highest rated" },
    { value: "primary_release_date.desc", label: "Newest" },
    { value: "primary_release_date.asc", label: "Oldest" },
    { value: "vote_count.desc", label: "Most votes" },
    { value: "revenue.desc", label: "Highest grossing" },
    { value: "title.asc", label: "Title A–Z" },
    { value: "title.desc", label: "Title Z–A" },
    { value: "vote_average.asc", label: "Lowest rated" },
    { value: "popularity.asc", label: "Least popular" },
  ],
  tv: [
    { value: "popularity.desc", label: "Most popular" },
    { value: "vote_average.desc", label: "Highest rated" },
    { value: "first_air_date.desc", label: "Newest" },
    { value: "first_air_date.asc", label: "Oldest" },
    { value: "vote_count.desc", label: "Most votes" },
    { value: "name.asc", label: "Title A–Z" },
    { value: "name.desc", label: "Title Z–A" },
    { value: "vote_average.asc", label: "Lowest rated" },
    { value: "popularity.asc", label: "Least popular" },
  ],
};

export const CERTIFICATIONS = ["G", "PG", "PG-13", "R", "NC-17", "NR"];
export const MONETIZATION = [
  { value: "flatrate", label: "Stream" },
  { value: "free", label: "Free" },
  { value: "ads", label: "With ads" },
  { value: "rent", label: "Rent" },
  { value: "buy", label: "Buy" },
];
export const LANGUAGES: [string, string][] = [
  ["en", "English"],
  ["ko", "Korean"],
  ["ja", "Japanese"],
  ["fr", "French"],
  ["es", "Spanish"],
  ["it", "Italian"],
  ["de", "German"],
  ["zh", "Chinese (Mandarin)"],
  ["cn", "Cantonese"],
  ["hi", "Hindi"],
  ["sv", "Swedish"],
  ["da", "Danish"],
  ["no", "Norwegian"],
  ["pt", "Portuguese"],
  ["ru", "Russian"],
  ["tr", "Turkish"],
  ["th", "Thai"],
  ["fa", "Persian"],
];
export const RUNTIME_MAX = 240; // the slider's top end means "no limit"
export const VOTE_STEPS = [0, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];
export const DEFAULT_MIN_VOTES = 100;
// Talk shows, news and soaps swamp TV results, so they're excluded until you include them.
export const TV_NOISE_GENRES = [10763, 10766, 10767];

type Params = Record<string, string | string[] | undefined>;

const ints = (v: string | undefined) =>
  (v ?? "")
    .split(/[,|]/)
    .map((x) => Number.parseInt(x, 10))
    .filter((n) => Number.isInteger(n) && n > 0);

const one = (params: Params, key: string) => {
  const v = params[key];
  return typeof v === "string" ? v : undefined;
};

function range(value: string | undefined, min: number, max: number): [number, number] {
  const [a, b] = (value ?? "").split("-").map(Number);
  const lo = Number.isFinite(a) ? Math.min(Math.max(a, min), max) : min;
  const hi = Number.isFinite(b) ? Math.min(Math.max(b, lo), max) : max;
  return [lo, hi];
}

/** Reads the Movies/TV filters out of the URL's query string, ignoring anything invalid. */
export function parseFilters(media: MediaType, params: Params): DiscoverFilters {
  const sort = one(params, "sort");
  const year = (key: string) => {
    const n = Number(one(params, key));
    return Number.isInteger(n) && n >= 1870 && n <= 2100 ? n : null;
  };
  const [scoreMin, scoreMax] = range(one(params, "score"), 0, 10);
  const [runtimeMin, runtimeMax] = range(one(params, "runtime"), 0, RUNTIME_MAX);
  const votes = Number(one(params, "votes"));
  const gx = one(params, "gx");
  return {
    media,
    sort: SORTS[media].some((s) => s.value === sort) ? sort! : "popularity.desc",
    genres: ints(one(params, "g")),
    excludeGenres: gx === undefined && media === "tv" ? TV_NOISE_GENRES : gx === "none" ? [] : ints(gx),
    from: year("from"),
    to: year("to"),
    scoreMin,
    scoreMax,
    minVotes: Number.isFinite(votes) && one(params, "votes") !== undefined ? Math.max(0, votes) : DEFAULT_MIN_VOTES,
    runtimeMin,
    runtimeMax,
    providers: ints(one(params, "prov")),
    monetization: (one(params, "mon") ?? "").split(",").filter((m) => MONETIZATION.some((x) => x.value === m)),
    language: /^[a-z]{2}$/.test(one(params, "lang") ?? "") ? one(params, "lang")! : "",
    certifications: media === "movie" ? (one(params, "cert") ?? "").split(",").filter((c) => CERTIFICATIONS.includes(c)) : [],
    keywords: ints(one(params, "kw")),
    people: media === "movie" ? ints(one(params, "people")) : [],
    hideSeen: one(params, "hide") === "seen",
    view: one(params, "view") === "list" ? "list" : "grid",
  };
}

/** The TMDB /discover query for these filters. */
export function toTmdbParams(f: DiscoverFilters): Record<string, string | number> {
  const p: Record<string, string | number> = { sort_by: f.sort };
  const dateKey = f.media === "movie" ? "primary_release_date" : "first_air_date";
  if (f.genres.length) p.with_genres = f.genres.join(",");
  if (f.excludeGenres.length) p.without_genres = f.excludeGenres.join(",");
  if (f.from) p[`${dateKey}.gte`] = `${f.from}-01-01`;
  if (f.to) p[`${dateKey}.lte`] = `${f.to}-12-31`;
  if (f.scoreMin > 0) p["vote_average.gte"] = f.scoreMin;
  if (f.scoreMax < 10) p["vote_average.lte"] = f.scoreMax;
  if (f.minVotes > 0) p["vote_count.gte"] = f.minVotes;
  if (f.runtimeMin > 0) p["with_runtime.gte"] = f.runtimeMin;
  if (f.runtimeMax < RUNTIME_MAX) p["with_runtime.lte"] = f.runtimeMax;
  if (f.providers.length) p.with_watch_providers = f.providers.join("|");
  if (f.monetization.length) p.with_watch_monetization_types = f.monetization.join("|");
  if (f.language) p.with_original_language = f.language;
  if (f.certifications.length) {
    p.certification_country = "US";
    p.certification = f.certifications.join("|");
  }
  if (f.keywords.length) p.with_keywords = f.keywords.join("|");
  if (f.people.length) p.with_people = f.people.join(",");
  return p;
}

/** Filters → URL query (only non-default values). */
export function toQuery(f: DiscoverFilters): string {
  const q = new URLSearchParams();
  if (f.sort !== "popularity.desc") q.set("sort", f.sort);
  if (f.genres.length) q.set("g", f.genres.join(","));
  const defaultExclude = f.media === "tv" ? TV_NOISE_GENRES : [];
  const sameExclude = f.excludeGenres.length === defaultExclude.length && f.excludeGenres.every((g) => defaultExclude.includes(g));
  if (!sameExclude) q.set("gx", f.excludeGenres.length ? f.excludeGenres.join(",") : "none");
  if (f.from) q.set("from", String(f.from));
  if (f.to) q.set("to", String(f.to));
  if (f.scoreMin > 0 || f.scoreMax < 10) q.set("score", `${f.scoreMin}-${f.scoreMax}`);
  if (f.minVotes !== DEFAULT_MIN_VOTES) q.set("votes", String(f.minVotes));
  if (f.runtimeMin > 0 || f.runtimeMax < RUNTIME_MAX) q.set("runtime", `${f.runtimeMin}-${f.runtimeMax}`);
  if (f.providers.length) q.set("prov", f.providers.join(","));
  if (f.monetization.length) q.set("mon", f.monetization.join(","));
  if (f.language) q.set("lang", f.language);
  if (f.certifications.length) q.set("cert", f.certifications.join(","));
  if (f.keywords.length) q.set("kw", f.keywords.join(","));
  if (f.people.length) q.set("people", f.people.join(","));
  if (f.hideSeen) q.set("hide", "seen");
  if (f.view === "list") q.set("view", "list");
  return q.toString();
}
