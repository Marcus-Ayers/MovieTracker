// The MovieTracker backup file (movietracker-backup.json). Shared by export (server) and restore (browser + server).
import { z } from "zod";

export const BACKUP_FORMAT = "movietracker-backup";
export const BACKUP_FILE = "movietracker-backup.json";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const mediaType = z.enum(["movie", "tv"]);

/** A title is stored by its TMDB id; everything else about it is re-pulled from TMDB on restore. */
export const backupTitle = z.object({
  ref: z.string().max(40), // "movie-949"
  tmdbId: z.number().int().positive(),
  mediaType,
  title: z.string().max(500),
  year: z.number().int().nullable(),
  imdbId: z.string().max(20).nullable(),
});

export const backupDiaryEntry = z.object({
  title: z.string().max(40), // a title ref
  watchedOn: date.nullable(),
  season: z.number().int().min(0).nullable(),
  rating: z.number().int().min(1).max(10).nullable(),
  liked: z.boolean(),
  rewatch: z.boolean(),
  reviewHtml: z.string().max(200_000).nullable(),
  mainReview: z.boolean(),
  spoilers: z.boolean(),
  where: z.string().max(80).nullable(),
  format: z.string().max(80).nullable(),
  with: z.string().max(200).nullable(),
  tags: z.array(z.string().max(60)).max(30),
  importKey: z.string().max(400).nullable(),
  createdAt: z.string().max(40),
  // Added later; older backups don't have it.
  skipRating: z.boolean().optional(),
});

export const backupWatchlistItem = z.object({ title: z.string().max(40), addedAt: z.string().max(40).nullable() });
export const backupSeenBefore = z.object({ title: z.string().max(40), count: z.number().int().min(1).max(10_000) });

export const backupProfile = z.object({
  displayName: z.string().max(60),
  username: z.string().max(40),
  visibility: z.enum(["everyone", "friends", "private"]),
  hideWatched: z.boolean(),
  ratePrompt: z.boolean().optional(),
  streamingServices: z.array(z.number().int().positive()).max(100).optional(),
});

export const backupSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.literal(1),
  exportedAt: z.string(),
  profile: backupProfile,
  titles: z.array(backupTitle),
  diary: z.array(backupDiaryEntry),
  watchlist: z.array(backupWatchlistItem),
  seenBefore: z.array(backupSeenBefore),
});

export type Backup = z.infer<typeof backupSchema>;
export type BackupTitle = z.infer<typeof backupTitle>;
export type BackupDiaryEntry = z.infer<typeof backupDiaryEntry>;

export const titleRef = (mediaType: "movie" | "tv", tmdbId: number) => `${mediaType}-${tmdbId}`;
