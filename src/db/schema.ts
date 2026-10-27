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
export const friendshipStatusEnum = pgEnum("friendship_status", ["pending", "accepted"]);
export const listKindEnum = pgEnum("list_kind", ["list", "tier"]);

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
  // The Clerk account that signs in as this user (Clerk handles passwords, Google, 2FA, etc.).
  clerkId: text("clerk_id").unique(),
  username: text("username").notNull().unique(),
  displayName: text("display_name").notNull(),
  // Only set on accounts created before Clerk; used once to link them, then cleared.
  passwordHash: text("password_hash"),
  visibility: visibilityEnum("visibility").notNull().default("everyone"),
  hideWatched: boolean("hide_watched").notNull().default(false),
  // Pop up "rate what you just watched on Plex" when new Plex watches show up.
  ratePrompt: boolean("rate_prompt").notNull().default(true),
  // Plex watches synced after this have not been shown in that pop-up yet.
  ratePromptSeenAt: timestamp("rate_prompt_seen_at", { withTimezone: true }).notNull().defaultNow(),
  // TMDB watch-provider ids of the streaming services you pay for (Netflix = 8, …).
  streamingServices: jsonb("streaming_services").$type<number[]>().notNull().default([]),
  // Social features. `social` off hides everything social and takes you out of other people's feeds and search.
  social: boolean("social").notNull().default(true),
  socialHome: boolean("social_home").notNull().default(true),
  socialTitles: boolean("social_titles").notNull().default(true),
  friendRequests: boolean("friend_requests").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
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
    // The film series it belongs to (e.g. "Harry Potter Collection"), so stats can count a series once.
    collectionId: integer("collection_id"),
    collectionName: text("collection_name"),
    // False for titles cached before series info was stored; they get backfilled.
    collectionChecked: boolean("collection_checked").notNull().default(false),
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
    // "Don't ask me to rate this" in the rating queue.
    skipRating: boolean("skip_rating").notNull().default(false),
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

/** A linked Plex account + the server we read watch history from. The token never leaves the server. */
export const plexConnections = pgTable("plex_connections", {
  userId: integer("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  // Identifies this site to Plex; must stay the same for the token to keep working.
  clientId: text("client_id").notNull(),
  authToken: text("auth_token"),
  pendingPinId: integer("pending_pin_id"),
  serverName: text("server_name"),
  serverId: text("server_id"),
  serverToken: text("server_token"),
  serverUri: text("server_uri"),
  // Whose plays count (Plex Home / shared servers have several accounts).
  accountId: integer("account_id"),
  accountName: text("account_name"),
  // For turning play timestamps into calendar dates.
  timeZone: text("time_zone").notNull().default("UTC"),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  lastSyncSummary: text("last_sync_summary"),
});

/** Plex library item → TMDB id, so each item is only looked up once. */
export const plexItems = pgTable(
  "plex_items",
  {
    serverId: text("server_id").notNull(),
    ratingKey: text("rating_key").notNull(),
    tmdbId: integer("tmdb_id"),
    mediaType: mediaTypeEnum("media_type"),
    title: text("title"),
    year: integer("year"),
  },
  (t) => [primaryKey({ columns: [t.serverId, t.ratingKey] })],
);

export type User = typeof users.$inferSelect;
/**
 * Friend requests and friendships: one row per pair. "pending" until the addressee accepts; declining,
 * cancelling or unfriending deletes the row.
 */
export const friendships = pgTable(
  "friendships",
  {
    requesterId: integer("requester_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    addresseeId: integer("addressee_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: friendshipStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.requesterId, t.addresseeId] }), index("friendships_addressee_idx").on(t.addresseeId)],
);

/** A tier on a tier list. `id` stays the same when you rename it. */
export type Tier = { id: string; label: string; color: string };

/** Your own lists ("Best heist movies") and tier lists. They follow your profile's privacy setting. */
export const lists = pgTable(
  "lists",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: listKindEnum("kind").notNull().default("list"),
    name: text("name").notNull(),
    description: text("description"),
    // Lists only: show 1, 2, 3… next to each title.
    ranked: boolean("ranked").notNull().default(false),
    // Tier lists only, top tier first.
    tiers: jsonb("tiers").$type<Tier[]>().notNull().default([]),
    // The featured list this was copied from ("nolan-ranked"), if any.
    source: text("source"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("lists_user_idx").on(t.userId)],
);

export const listItems = pgTable(
  "list_items",
  {
    listId: integer("list_id")
      .notNull()
      .references(() => lists.id, { onDelete: "cascade" }),
    titleId: integer("title_id")
      .notNull()
      .references(() => titles.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    // Tier lists: the Tier.id it's in; null = not placed yet.
    tier: text("tier"),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.listId, t.titleId] })],
);

export type Title = typeof titles.$inferSelect;
export type Viewing = typeof viewings.$inferSelect;
export type List = typeof lists.$inferSelect;
export type Visibility = (typeof visibilityEnum.enumValues)[number];
