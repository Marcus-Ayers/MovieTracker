import "server-only";
import { cacheLife } from "next/cache";
import type { Genre, SeasonInfo } from "@/db/schema";
import type { MediaType } from "./format";

const API = "https://api.themoviedb.org/3";

/** The key in .env.local can be either TMDB credential: the long "API Read Access Token" or the short v3 "API Key". */
export function hasTmdbKey() {
  return Boolean(process.env.TMDB_API_KEY?.trim());
}

type Params = Record<string, string | number | boolean | undefined | null>;

async function tmdb<T>(path: string, params: Params = {}): Promise<T> {
  const key = process.env.TMDB_API_KEY?.trim();
  if (!key) throw new Error("TMDB_API_KEY is missing. Add it to .env.local and restart the dev server.");

  const url = new URL(API + path);
  url.searchParams.set("language", "en-US");
  for (const [name, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(name, String(value));
  }
  const headers: Record<string, string> = { accept: "application/json" };
  if (key.startsWith("eyJ")) headers.authorization = `Bearer ${key}`;
  else url.searchParams.set("api_key", key);

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`TMDB request failed (${res.status}) for ${path}`);
  return (await res.json()) as T;
}

// ---------------------------------------------------------------------------
// Shared shapes
// ---------------------------------------------------------------------------

export type MediaItem = {
  id: number;
  mediaType: MediaType;
  title: string;
  year: number | null;
  date: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  overview: string;
  voteAverage: number;
  voteCount: number;
  genreIds: number[];
};

type RawItem = {
  id: number;
  media_type?: string;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  overview?: string;
  vote_average?: number;
  vote_count?: number;
  genre_ids?: number[];
  adult?: boolean;
};

type Paged<T> = { page: number; results: T[]; total_pages: number; total_results: number };

function toItem(raw: RawItem, fallback?: MediaType): MediaItem | null {
  const mediaType = raw.media_type ?? fallback;
  if (mediaType !== "movie" && mediaType !== "tv") return null;
  const date = (mediaType === "movie" ? raw.release_date : raw.first_air_date) || null;
  return {
    id: raw.id,
    mediaType,
    title: (mediaType === "movie" ? raw.title : raw.name) ?? raw.title ?? raw.name ?? "Untitled",
    year: date ? Number(date.slice(0, 4)) : null,
    date,
    posterPath: raw.poster_path ?? null,
    backdropPath: raw.backdrop_path ?? null,
    overview: raw.overview ?? "",
    voteAverage: raw.vote_average ?? 0,
    voteCount: raw.vote_count ?? 0,
    genreIds: raw.genre_ids ?? [],
  };
}

function toItems(results: RawItem[], fallback?: MediaType) {
  return results.map((r) => toItem(r, fallback)).filter((x): x is MediaItem => x !== null && !!x.posterPath);
}

// ---------------------------------------------------------------------------
// Lists for browsing
// ---------------------------------------------------------------------------

export async function getTrending(media: MediaType | "all", window: "day" | "week") {
  "use cache";
  cacheLife("hours");
  const data = await tmdb<Paged<RawItem>>(`/trending/${media}/${window}`);
  return toItems(data.results, media === "all" ? undefined : media);
}

export async function getMovieList(list: "now_playing" | "upcoming" | "popular" | "top_rated") {
  "use cache";
  cacheLife("hours");
  const regional = list === "now_playing" || list === "upcoming";
  const data = await tmdb<Paged<RawItem>>(`/movie/${list}`, regional ? { region: "US" } : {});
  let items = toItems(data.results, "movie");
  if (list === "upcoming") {
    const today = new Date().toISOString().slice(0, 10);
    items = items.filter((i) => !i.date || i.date >= today).sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
  }
  return items;
}

export async function getTvList(list: "popular" | "top_rated" | "on_the_air" | "airing_today") {
  "use cache";
  cacheLife("hours");
  const data = await tmdb<Paged<RawItem>>(`/tv/${list}`);
  return toItems(data.results, "tv");
}

/** TMDB's Discover endpoint: every filter/sort combo. Params are passed straight through. */
export async function discover(media: MediaType, params: Record<string, string | number>, page = 1) {
  "use cache";
  cacheLife("hours");
  const data = await tmdb<Paged<RawItem>>(`/discover/${media}`, {
    include_adult: false,
    watch_region: "US",
    ...params,
    page,
  });
  return { items: toItems(data.results, media), totalPages: data.total_pages, totalResults: data.total_results };
}

export async function getLogoPath(media: MediaType, id: number) {
  "use cache";
  cacheLife("days");
  const data = await tmdb<{ logos: { file_path: string; iso_639_1: string | null; vote_average: number }[] }>(
    `/${media}/${id}/images`,
    { include_image_language: "en,null" },
  );
  return pickLogo(data.logos);
}

function pickLogo(logos: { file_path: string; iso_639_1: string | null }[] | undefined) {
  if (!logos?.length) return null;
  return (logos.find((l) => l.iso_639_1 === "en") ?? logos[0]).file_path;
}

export async function searchTitles(query: string, page = 1) {
  "use cache";
  cacheLife("hours");
  const data = await tmdb<Paged<RawItem & { profile_path?: string | null; known_for_department?: string }>>(
    "/search/multi",
    { query, page, include_adult: false },
  );
  const people = data.results
    .filter((r) => r.media_type === "person")
    .map((r) => ({
      id: r.id,
      name: r.name ?? "",
      profilePath: r.profile_path ?? null,
      knownFor: r.known_for_department ?? "",
    }));
  return { items: toItems(data.results), people, totalPages: data.total_pages };
}

export type MovieSearchHit = {
  id: number;
  title: string;
  originalTitle: string;
  year: number | null;
  posterPath: string | null;
};

/** Movie-only search, optionally pinned to a release year. Used to match imported Letterboxd films. */
export async function searchMovies(query: string, year: number | null): Promise<MovieSearchHit[]> {
  "use cache";
  cacheLife("days");
  const data = await tmdb<Paged<RawItem & { original_title?: string }>>("/search/movie", {
    query,
    primary_release_year: year ?? undefined,
    include_adult: false,
  });
  return data.results.slice(0, 10).map((r) => ({
    id: r.id,
    title: r.title ?? "",
    originalTitle: r.original_title ?? "",
    year: r.release_date ? Number(r.release_date.slice(0, 4)) : null,
    posterPath: r.poster_path ?? null,
  }));
}

// ---------------------------------------------------------------------------
// Lookups for the Movies / TV filter sidebar
// ---------------------------------------------------------------------------

export type WatchProvider = { id: number; name: string; logoPath: string };

/** Streaming services available in the US, most popular first. */
export async function getWatchProviders(media: MediaType): Promise<WatchProvider[]> {
  "use cache";
  cacheLife("days");
  const data = await tmdb<{
    results: { provider_id: number; provider_name: string; logo_path: string; display_priorities?: Record<string, number> }[];
  }>(`/watch/providers/${media}`, { watch_region: "US" });
  return data.results
    .sort((a, b) => (a.display_priorities?.US ?? 999) - (b.display_priorities?.US ?? 999))
    .map((p) => ({ id: p.provider_id, name: p.provider_name, logoPath: p.logo_path }));
}

/** TMDB id for an IMDb (tt…) or TVDB id. Used when a Plex item only carries those. */
export async function findByExternalId(
  externalId: string,
  source: "imdb_id" | "tvdb_id",
): Promise<{ mediaType: MediaType; tmdbId: number } | null> {
  "use cache";
  cacheLife("days");
  try {
    const data = await tmdb<{ movie_results: { id: number }[]; tv_results: { id: number }[] }>(`/find/${encodeURIComponent(externalId)}`, {
      external_source: source,
    });
    if (data.movie_results[0]) return { mediaType: "movie", tmdbId: data.movie_results[0].id };
    if (data.tv_results[0]) return { mediaType: "tv", tmdbId: data.tv_results[0].id };
    return null;
  } catch {
    return null;
  }
}

export type NamedId = { id: number; name: string };

export async function searchKeywords(query: string): Promise<NamedId[]> {
  "use cache";
  cacheLife("days");
  const data = await tmdb<Paged<{ id: number; name: string }>>("/search/keyword", { query });
  return data.results.slice(0, 10);
}

export async function getKeyword(id: number): Promise<NamedId | null> {
  "use cache";
  cacheLife("days");
  try {
    return await tmdb<NamedId>(`/keyword/${id}`);
  } catch {
    return null;
  }
}

export async function searchPeople(query: string): Promise<(Person & { knownFor: string })[]> {
  "use cache";
  cacheLife("days");
  const data = await tmdb<Paged<{ id: number; name: string; profile_path: string | null; known_for_department?: string }>>(
    "/search/person",
    { query, include_adult: false },
  );
  return data.results.slice(0, 8).map((p) => ({
    id: p.id,
    name: p.name,
    profilePath: p.profile_path,
    knownFor: p.known_for_department ?? "",
  }));
}

/** Just a person's name and photo (much lighter than getPerson). */
export async function getPersonBasic(id: number): Promise<Person | null> {
  "use cache";
  cacheLife("days");
  try {
    const p = await tmdb<{ id: number; name: string; profile_path: string | null }>(`/person/${id}`);
    return { id: p.id, name: p.name, profilePath: p.profile_path };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Title details
// ---------------------------------------------------------------------------

export type Person = { id: number; name: string; profilePath: string | null };
export type CastMember = Person & { character: string | null; episodeCount?: number };
export type CrewGroup = { job: string; people: Person[] };
export type Provider = { id: number; name: string; logoPath: string };
export type Video = { key: string; name: string; type: string };

export type TitleDetails = {
  id: number;
  mediaType: MediaType;
  title: string;
  originalTitle: string | null;
  tagline: string | null;
  overview: string;
  year: number | null;
  releaseDate: string | null;
  runtime: number | null;
  status: string | null;
  genres: Genre[];
  posterPath: string | null;
  backdropPath: string | null;
  logoPath: string | null;
  voteAverage: number;
  voteCount: number;
  certification: string | null;
  originalLanguage: string | null;
  spokenLanguages: string[];
  countries: string[];
  budget: number | null;
  revenue: number | null;
  imdbId: string | null;
  homepage: string | null;
  directors: Person[];
  writers: Person[];
  creators: Person[];
  cast: CastMember[];
  crew: CrewGroup[];
  trailer: Video | null;
  videos: Video[];
  providers: { link: string | null; stream: Provider[]; rent: Provider[]; buy: Provider[] } | null;
  recommendations: MediaItem[];
  keywords: { id: number; name: string }[];
  collection: { id: number; name: string } | null;
  companies: { id: number; name: string; logoPath: string | null }[];
  networks: { id: number; name: string; logoPath: string | null }[];
  seasons: SeasonInfo[];
  numberOfSeasons: number | null;
  numberOfEpisodes: number | null;
  lastAirDate: string | null;
  inProduction: boolean;
};

type RawPerson = { id: number; name: string; profile_path: string | null };
type RawCrew = RawPerson & { job: string; department: string };
type RawCast = RawPerson & { character?: string; order?: number };
type RawAggregateCast = RawPerson & { roles?: { character: string; episode_count: number }[]; total_episode_count?: number };
type RawProviders = {
  results?: Record<string, { link?: string; flatrate?: RawProvider[]; rent?: RawProvider[]; buy?: RawProvider[] }>;
};
type RawProvider = { provider_id: number; provider_name: string; logo_path: string; display_priority: number };
type RawVideo = { key: string; name: string; site: string; type: string; official: boolean };
type RawCompany = { id: number; name: string; logo_path: string | null };

type RawCommon = {
  id: number;
  overview?: string;
  tagline?: string;
  status?: string;
  genres?: Genre[];
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average?: number;
  vote_count?: number;
  original_language?: string;
  spoken_languages?: { english_name: string }[];
  homepage?: string;
  production_companies?: RawCompany[];
  production_countries?: { iso_3166_1: string; name: string }[];
  videos?: { results: RawVideo[] };
  "watch/providers"?: RawProviders;
  recommendations?: Paged<RawItem>;
  images?: { logos: { file_path: string; iso_639_1: string | null }[] };
  external_ids?: { imdb_id?: string | null };
};

type RawMovie = RawCommon & {
  title: string;
  original_title?: string;
  release_date?: string;
  runtime?: number;
  budget?: number;
  revenue?: number;
  imdb_id?: string | null;
  belongs_to_collection?: { id: number; name: string } | null;
  credits?: { cast: RawCast[]; crew: RawCrew[] };
  release_dates?: { results: { iso_3166_1: string; release_dates: { certification: string; type: number }[] }[] };
  keywords?: { keywords: { id: number; name: string }[] };
};

type RawTv = RawCommon & {
  name: string;
  original_name?: string;
  first_air_date?: string;
  last_air_date?: string;
  episode_run_time?: number[];
  number_of_seasons?: number;
  number_of_episodes?: number;
  in_production?: boolean;
  origin_country?: string[];
  created_by?: RawPerson[];
  networks?: RawCompany[];
  seasons?: { season_number: number; name: string; episode_count: number; air_date: string | null; poster_path: string | null }[];
  aggregate_credits?: { cast: RawAggregateCast[]; crew: (RawPerson & { jobs?: { job: string }[]; department: string })[] };
  content_ratings?: { results: { iso_3166_1: string; rating: string }[] };
  keywords?: { results: { id: number; name: string }[] };
};

const person = (p: RawPerson): Person => ({ id: p.id, name: p.name, profilePath: p.profile_path });

function uniquePeople(list: RawPerson[]) {
  const seen = new Set<number>();
  return list.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true))).map(person);
}

function pickVideos(raw: RawVideo[] | undefined) {
  const youtube = (raw ?? []).filter((v) => v.site === "YouTube");
  const rank = (v: RawVideo) => (v.type === "Trailer" ? 0 : v.type === "Teaser" ? 1 : 2) + (v.official ? 0 : 0.5);
  const sorted = [...youtube].sort((a, b) => rank(a) - rank(b));
  const videos = sorted.slice(0, 8).map((v) => ({ key: v.key, name: v.name, type: v.type }));
  const trailer = videos.find((v) => v.type === "Trailer" || v.type === "Teaser") ?? null;
  return { videos, trailer };
}

function pickProviders(raw: RawProviders | undefined) {
  const us = raw?.results?.US;
  if (!us) return null;
  const map = (list?: RawProvider[]) =>
    (list ?? [])
      .sort((a, b) => a.display_priority - b.display_priority)
      .map((p) => ({ id: p.provider_id, name: p.provider_name, logoPath: p.logo_path }));
  return { link: us.link ?? null, stream: map(us.flatrate), rent: map(us.rent), buy: map(us.buy) };
}

function crewGroups(crew: RawCrew[], jobs: [label: string, matches: string[]][]) {
  return jobs
    .map(([label, matches]) => ({
      job: label,
      people: uniquePeople(crew.filter((c) => matches.includes(c.job))),
    }))
    .filter((g) => g.people.length > 0);
}

function common(raw: RawCommon) {
  const { videos, trailer } = pickVideos(raw.videos?.results);
  return {
    overview: raw.overview ?? "",
    tagline: raw.tagline || null,
    status: raw.status ?? null,
    genres: raw.genres ?? [],
    posterPath: raw.poster_path,
    backdropPath: raw.backdrop_path,
    logoPath: pickLogo(raw.images?.logos),
    voteAverage: raw.vote_average ?? 0,
    voteCount: raw.vote_count ?? 0,
    originalLanguage: raw.original_language ?? null,
    spokenLanguages: (raw.spoken_languages ?? []).map((l) => l.english_name).filter(Boolean),
    homepage: raw.homepage || null,
    companies: (raw.production_companies ?? []).map((c) => ({ id: c.id, name: c.name, logoPath: c.logo_path })),
    trailer,
    videos,
    providers: pickProviders(raw["watch/providers"]),
    recommendations: toItems(raw.recommendations?.results ?? []).slice(0, 20),
  };
}

export async function getMovieDetails(id: number): Promise<TitleDetails> {
  "use cache";
  cacheLife("days");
  const raw = await tmdb<RawMovie>(`/movie/${id}`, {
    append_to_response: "credits,videos,release_dates,watch/providers,recommendations,keywords,images",
    include_image_language: "en,null",
  });
  const crew = raw.credits?.crew ?? [];
  const usRelease = raw.release_dates?.results.find((r) => r.iso_3166_1 === "US");
  const certification =
    usRelease?.release_dates.find((d) => d.certification && d.type === 3)?.certification ??
    usRelease?.release_dates.find((d) => d.certification)?.certification ??
    null;
  const releaseDate = raw.release_date || null;

  return {
    ...common(raw),
    id: raw.id,
    mediaType: "movie",
    title: raw.title,
    originalTitle: raw.original_title && raw.original_title !== raw.title ? raw.original_title : null,
    year: releaseDate ? Number(releaseDate.slice(0, 4)) : null,
    releaseDate,
    runtime: raw.runtime || null,
    certification,
    countries: (raw.production_countries ?? []).map((c) => c.name),
    budget: raw.budget || null,
    revenue: raw.revenue || null,
    imdbId: raw.imdb_id || null,
    directors: uniquePeople(crew.filter((c) => c.job === "Director")),
    writers: uniquePeople(crew.filter((c) => ["Screenplay", "Writer", "Story", "Author", "Novel"].includes(c.job))),
    creators: [],
    cast: (raw.credits?.cast ?? []).slice(0, 24).map((c) => ({ ...person(c), character: c.character || null })),
    crew: crewGroups(crew, [
      ["Producers", ["Producer"]],
      ["Music", ["Original Music Composer", "Music"]],
      ["Cinematography", ["Director of Photography"]],
      ["Editing", ["Editor"]],
      ["Production Design", ["Production Design"]],
    ]),
    keywords: raw.keywords?.keywords ?? [],
    collection: raw.belongs_to_collection ? { id: raw.belongs_to_collection.id, name: raw.belongs_to_collection.name } : null,
    networks: [],
    seasons: [],
    numberOfSeasons: null,
    numberOfEpisodes: null,
    lastAirDate: null,
    inProduction: false,
  };
}

export async function getTvDetails(id: number): Promise<TitleDetails> {
  "use cache";
  cacheLife("days");
  const raw = await tmdb<RawTv>(`/tv/${id}`, {
    append_to_response: "aggregate_credits,videos,content_ratings,watch/providers,recommendations,keywords,images,external_ids",
    include_image_language: "en,null",
  });
  const firstAir = raw.first_air_date || null;
  const crew = raw.aggregate_credits?.crew ?? [];
  const crewFlat: RawCrew[] = crew.flatMap((c) => (c.jobs ?? []).map((j) => ({ ...c, job: j.job })));

  return {
    ...common(raw),
    id: raw.id,
    mediaType: "tv",
    title: raw.name,
    originalTitle: raw.original_name && raw.original_name !== raw.name ? raw.original_name : null,
    year: firstAir ? Number(firstAir.slice(0, 4)) : null,
    releaseDate: firstAir,
    runtime: raw.episode_run_time?.[0] ?? null,
    certification: raw.content_ratings?.results.find((r) => r.iso_3166_1 === "US")?.rating || null,
    countries: raw.origin_country ?? [],
    budget: null,
    revenue: null,
    imdbId: raw.external_ids?.imdb_id || null,
    directors: [],
    writers: [],
    creators: uniquePeople(raw.created_by ?? []),
    cast: (raw.aggregate_credits?.cast ?? []).slice(0, 24).map((c) => ({
      ...person(c),
      character: c.roles?.[0]?.character || null,
      episodeCount: c.total_episode_count,
    })),
    crew: crewGroups(crewFlat, [
      ["Executive Producers", ["Executive Producer"]],
      ["Music", ["Original Music Composer", "Main Title Theme Composer"]],
    ]).map((g) => ({ ...g, people: g.people.slice(0, 6) })),
    keywords: raw.keywords?.results ?? [],
    collection: null,
    networks: (raw.networks ?? []).map((n) => ({ id: n.id, name: n.name, logoPath: n.logo_path })),
    seasons: (raw.seasons ?? [])
      .map((s) => ({
        number: s.season_number,
        name: s.name,
        episodeCount: s.episode_count,
        airDate: s.air_date,
        posterPath: s.poster_path,
      }))
      // Real seasons first, "Specials" (season 0) last.
      .sort((a, b) => (a.number === 0 ? 1 : b.number === 0 ? -1 : a.number - b.number)),
    numberOfSeasons: raw.number_of_seasons ?? null,
    numberOfEpisodes: raw.number_of_episodes ?? null,
    lastAirDate: raw.last_air_date || null,
    inProduction: raw.in_production ?? false,
  };
}

export function getTitleDetails(media: MediaType, id: number) {
  return media === "movie" ? getMovieDetails(id) : getTvDetails(id);
}

export async function getCollection(id: number) {
  "use cache";
  cacheLife("days");
  const raw = await tmdb<{ id: number; name: string; parts: RawItem[] }>(`/collection/${id}`);
  const parts = toItems(raw.parts, "movie").sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999"));
  return { id: raw.id, name: raw.name, parts };
}

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

export type PersonCredit = MediaItem & { role: string | null; episodeCount?: number };

export type PersonDetails = {
  id: number;
  name: string;
  biography: string;
  birthday: string | null;
  deathday: string | null;
  placeOfBirth: string | null;
  profilePath: string | null;
  knownFor: string;
  imdbId: string | null;
  directing: PersonCredit[];
  writing: PersonCredit[];
  acting: PersonCredit[];
};

export async function getPerson(id: number): Promise<PersonDetails> {
  "use cache";
  cacheLife("days");
  type RawCredit = RawItem & { character?: string; job?: string; department?: string; episode_count?: number };
  const raw = await tmdb<{
    id: number;
    name: string;
    biography?: string;
    birthday?: string | null;
    deathday?: string | null;
    place_of_birth?: string | null;
    profile_path: string | null;
    known_for_department?: string;
    imdb_id?: string | null;
    combined_credits?: { cast: RawCredit[]; crew: RawCredit[] };
  }>(`/person/${id}`, { append_to_response: "combined_credits" });

  const collect = (list: RawCredit[], roleOf: (c: RawCredit) => string | null) => {
    const byKey = new Map<string, PersonCredit>();
    for (const c of list) {
      const item = toItem(c);
      if (!item || !item.posterPath) continue;
      const key = `${item.mediaType}-${item.id}`;
      const existing = byKey.get(key);
      if (existing) {
        const role = roleOf(c);
        if (role && existing.role && !existing.role.includes(role)) existing.role += `, ${role}`;
      } else {
        byKey.set(key, { ...item, role: roleOf(c), episodeCount: c.episode_count });
      }
    }
    // Newest first; unreleased/undated titles at the top.
    return [...byKey.values()].sort((a, b) => (b.date ?? "9999").localeCompare(a.date ?? "9999"));
  };

  const crew = raw.combined_credits?.crew ?? [];
  const cast = (raw.combined_credits?.cast ?? []).filter(
    // Skip talk-show / awards appearances that flood actor filmographies.
    (c) => !(c.media_type === "tv" && /^(Self|Himself|Herself|Themselves|Host)\b/i.test(c.character ?? "")),
  );

  return {
    id: raw.id,
    name: raw.name,
    biography: raw.biography ?? "",
    birthday: raw.birthday ?? null,
    deathday: raw.deathday ?? null,
    placeOfBirth: raw.place_of_birth ?? null,
    profilePath: raw.profile_path,
    knownFor: raw.known_for_department ?? "Acting",
    imdbId: raw.imdb_id ?? null,
    directing: collect(
      crew.filter((c) => c.job === "Director"),
      () => null,
    ),
    writing: collect(
      crew.filter((c) => c.department === "Writing"),
      (c) => c.job ?? null,
    ),
    acting: collect(cast, (c) => c.character || null),
  };
}
