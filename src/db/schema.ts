import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  serial,
  smallint,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const mediaTypeEnum = pgEnum("media_type", ["movie", "tv"]);
export const visibilityEnum = pgEnum("visibility", ["everyone", "friends", "private"]);
export const creditRoleEnum = pgEnum("credit_role", ["director", "writer", "creator", "cast"]);

export type Genre = { id: number; name: string };
export type SeasonInfo = {
  number: number;
  name: string;
  episodeCount: number;
  airDate: string | null;
  posterPath: string | null;
};

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  displayName: text("display_name").notNull(),
  passwordHash: text("password_hash").notNull(),
  visibility: visibilityEnum("visibility").notNull().default("everyone"),
  hideWatched: boolean("hide_watched").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  // SHA-256 of the cookie token, so a leaked database can't be used to log in.
  id: text("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

/** A movie or TV show cached from TMDB. Refreshed in the background so it never gets older than TMDB allows. */
export const titles = pgTable(
  "titles",
  {
    id: serial("id").primaryKey(),
    tmdbId: integer("tmdb_id").notNull(),
    mediaType: mediaTypeEnum("media_type").notNull(),
    title: text("title").notNull(),
    originalTitle: text("original_title"),
    year: integer("year"),
    releaseDate: date("release_date"),
    posterPath: text("poster_path"),
    backdropPath: text("backdrop_path"),
    overview: text("overview"),
    // Minutes. For TV this is the typical episode runtime.
    runtime: integer("runtime"),
    genres: jsonb("genres").$type<Genre[]>().notNull().default([]),
    countries: jsonb("countries").$type<string[]>().notNull().default([]),
    originalLanguage: text("original_language"),
    imdbId: text("imdb_id"),
    voteAverage: real("vote_average"),
    seasons: jsonb("seasons").$type<SeasonInfo[]>().notNull().default([]),
    refreshedAt: timestamp("refreshed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("titles_tmdb_idx").on(t.tmdbId, t.mediaType)],
);

export const people = pgTable("people", {
  tmdbId: integer("tmdb_id").primaryKey(),
  name: text("name").notNull(),
  profilePath: text("profile_path"),
});

export const credits = pgTable(
  "credits",
  {
    titleId: integer("title_id")
      .notNull()
      .references(() => titles.id, { onDelete: "cascade" }),
    personId: integer("person_id")
      .notNull()
      .references(() => people.tmdbId, { onDelete: "cascade" }),
    role: creditRoleEnum("role").notNull(),
    character: text("character"),
    order: integer("order").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.titleId, t.personId, t.role] }), index("credits_person_idx").on(t.personId)],
);

/** One diary entry: a single time you watched a movie, or finished a season of a show. */
export const viewings = pgTable(
  "viewings",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    titleId: integer("title_id")
      .notNull()
      .references(() => titles.id, { onDelete: "cascade" }),
    // null = "watched, date unknown"
    watchedOn: date("watched_on"),
    // TV only. null on a TV entry = the whole series.
    seasonNumber: integer("season_number"),
    rating: smallint("rating"),
    liked: boolean("liked").notNull().default(false),
    isRewatch: boolean("is_rewatch").notNull().default(false),
    reviewHtml: text("review_html"),
    isMainReview: boolean("is_main_review").notNull().default(false),
    containsSpoilers: boolean("contains_spoilers").notNull().default(false),
    watchedWhere: text("watched_where"),
    format: text("format"),
    watchedWith: text("watched_with"),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    // Set on imported entries (e.g. "lb:diary:<uri>", "tmdb:movie:550") so re-running an import skips them.
    importKey: text("import_key"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("viewings_user_date_idx").on(t.userId, t.watchedOn),
    index("viewings_title_idx").on(t.titleId),
    uniqueIndex("viewings_import_key_idx").on(t.userId, t.importKey),
  ],
);

/** Per-user state for a title that isn't tied to a single viewing. */
export const userTitles = pgTable(
  "user_titles",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    titleId: integer("title_id")
      .notNull()
      .references(() => titles.id, { onDelete: "cascade" }),
    // Times watched before you started logging (no dates).
    priorWatchCount: integer("prior_watch_count").notNull().default(0),
    onWatchlist: boolean("on_watchlist").notNull().default(false),
    watchlistedAt: timestamp("watchlisted_at", { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.titleId] })],
);

/**
 * Rotten Tomatoes / Metacritic (and a fallback IMDb rating) from OMDb, saved permanently.
 * Older films are never re-fetched; recent releases are refreshed now and then (see lib/ratings.ts).
 */
export const externalRatings = pgTable("external_ratings", {
  imdbId: text("imdb_id").primaryKey(),
  imdb: text("imdb"),
  rottenTomatoes: text("rotten_tomatoes"),
  metacritic: text("metacritic"),
  // Release year from OMDb; decides whether the scores can still change.
  year: integer("year"),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
});

/** IMDb's own daily ratings file (titles with 1,000+ votes). Free IMDb ratings with no API calls. */
export const imdbRatings = pgTable(
  "imdb_ratings",
  {
    tconst: text("tconst").primaryKey(),
    rating: real("rating").notNull(),
    votes: integer("votes").notNull(),
  },
  (t) => [index("imdb_ratings_votes_idx").on(t.votes)],
);

/** Calls per day to rate-limited services (OMDb: 1,000/day on the free tier). */
export const apiUsage = pgTable(
  "api_usage",
  {
    day: date("day").notNull(),
    service: text("service").notNull(),
    calls: integer("calls").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.day, t.service] })],
);

/** When each background job last ran, and what it did. */
export const jobRuns = pgTable("job_runs", {
  name: text("name").primaryKey(),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }).notNull(),
  summary: text("summary"),
});

export type User = typeof users.$inferSelect;
export type Title = typeof titles.$inferSelect;
export type Viewing = typeof viewings.$inferSelect;
export type Visibility = (typeof visibilityEnum.enumValues)[number];
