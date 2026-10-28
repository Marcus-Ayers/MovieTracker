import "server-only";
import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { strToU8, zipSync } from "fflate";
import Papa from "papaparse";
import sanitizeHtml from "sanitize-html";
import { getDb, listItems, lists, titles, userTitles, users, viewings, type DB } from "@/db";
import { BACKUP_FILE, BACKUP_FORMAT, titleRef, type Backup, type BackupDiaryEntry, type BackupList, type BackupTitle } from "./backup-format";
import { mapLimit } from "./async";
import { cleanReview } from "./reviews";
import { ensureTitle } from "./title-cache";

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export async function buildBackup(userId: number): Promise<Backup> {
  const db = await getDb();
  const [[user], diaryRows, stateRows, listRows, listItemRows] = await Promise.all([
    db.select().from(users).where(eq(users.id, userId)),
    db
      .select({ v: viewings, t: titles })
      .from(viewings)
      .innerJoin(titles, eq(viewings.titleId, titles.id))
      .where(eq(viewings.userId, userId))
      .orderBy(sql`${viewings.watchedOn} asc nulls first`, viewings.createdAt),
    db
      .select({ s: userTitles, t: titles })
      .from(userTitles)
      .innerJoin(titles, eq(userTitles.titleId, titles.id))
      .where(eq(userTitles.userId, userId)),
    db.select().from(lists).where(eq(lists.userId, userId)).orderBy(lists.createdAt),
    db
      .select({ listId: listItems.listId, tier: listItems.tier, t: titles })
      .from(listItems)
      .innerJoin(lists, eq(lists.id, listItems.listId))
      .innerJoin(titles, eq(titles.id, listItems.titleId))
      .where(eq(lists.userId, userId))
      .orderBy(listItems.position),
  ]);

  const titleMap = new Map<string, BackupTitle>();
  const addTitle = (t: typeof titles.$inferSelect) => {
    const ref = titleRef(t.mediaType, t.tmdbId);
    if (!titleMap.has(ref)) {
      titleMap.set(ref, { ref, tmdbId: t.tmdbId, mediaType: t.mediaType, title: t.title, year: t.year, imdbId: t.imdbId });
    }
    return ref;
  };

  const diary: BackupDiaryEntry[] = diaryRows.map(({ v, t }) => ({
    title: addTitle(t),
    watchedOn: v.watchedOn,
    season: v.seasonNumber,
    rating: v.rating,
    liked: v.liked,
    rewatch: v.isRewatch,
    reviewHtml: v.reviewHtml,
    mainReview: v.isMainReview,
    spoilers: v.containsSpoilers,
    where: v.watchedWhere,
    format: v.format,
    with: v.watchedWith,
    tags: v.tags,
    importKey: v.importKey,
    createdAt: v.createdAt.toISOString(),
    skipRating: v.skipRating,
  }));
  const watchlist = stateRows
    .filter(({ s }) => s.onWatchlist)
    .map(({ s, t }) => ({ title: addTitle(t), addedAt: s.watchlistedAt?.toISOString() ?? null }));
  const seenBefore = stateRows
    .filter(({ s }) => s.priorWatchCount > 0)
    .map(({ s, t }) => ({ title: addTitle(t), count: s.priorWatchCount }));
  const userLists: BackupList[] = listRows.map((l) => ({
    name: l.name,
    description: l.description,
    kind: l.kind,
    ranked: l.ranked,
    tiers: l.tiers,
    source: l.source,
    items: listItemRows.filter((i) => i.listId === l.id).map((i) => ({ title: addTitle(i.t), tier: i.tier })),
  }));

  return {
    format: BACKUP_FORMAT,
    version: 1,
    exportedAt: new Date().toISOString(),
    profile: {
      displayName: user.displayName,
      username: user.username,
      visibility: user.visibility,
      hideWatched: user.hideWatched,
      ratePrompt: user.ratePrompt,
      streamingServices: user.streamingServices,
      social: user.social,
      socialHome: user.socialHome,
      socialTitles: user.socialTitles,
      friendRequests: user.friendRequests,
    },
    titles: [...titleMap.values()],
    diary,
    watchlist,
    seenBefore,
    lists: userLists,
  };
}

/** Review HTML → plain text with blank lines between paragraphs (for the CSVs). */
function reviewText(html: string | null) {
  if (!html) return "";
  const withBreaks = html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|h2|h3|li|blockquote)>/gi, "\n\n");
  return sanitizeHtml(withBreaks, { allowedTags: [], allowedAttributes: {} })
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const README = `MovieTracker export
===================

movietracker-backup.json
  Everything: diary (dated and undated), ratings, reviews, likes, rewatches, tags,
  TV seasons, watchlist, "seen before" counts, lists and tier lists, and profile settings.
  To restore: Settings → Import → drop this ZIP (or the JSON) onto the page.
  Works on this account (duplicates are skipped) or a brand-new one.

diary.csv / watchlist.csv
  Movies only, in Letterboxd's import format (tmdbID, Rating10, WatchedDate…),
  so you can import them at letterboxd.com/import or open them in a spreadsheet.

tv-diary.csv
  Your TV seasons (Letterboxd doesn't do TV).

Not included: your password and your Plex sign-in. Reconnect Plex after restoring.
`;

/** The downloadable ZIP: the full JSON backup plus spreadsheet/Letterboxd-friendly CSVs. */
export function backupToZip(backup: Backup) {
  const byRef = new Map(backup.titles.map((t) => [t.ref, t]));
  const movieDiary = backup.diary.filter((d) => byRef.get(d.title)?.mediaType === "movie");
  const tvDiary = backup.diary.filter((d) => byRef.get(d.title)?.mediaType === "tv");

  const diaryCsv = Papa.unparse(
    movieDiary.map((d) => {
      const t = byRef.get(d.title)!;
      return {
        tmdbID: t.tmdbId,
        imdbID: t.imdbId ?? "",
        Title: t.title,
        Year: t.year ?? "",
        WatchedDate: d.watchedOn ?? "",
        Rating10: d.rating ?? "",
        Rewatch: d.rewatch ? "true" : "",
        Tags: d.tags.join(", "),
        Review: reviewText(d.reviewHtml),
        Liked: d.liked ? "true" : "",
        Where: d.where ?? "",
      };
    }),
  );
  const tvCsv = Papa.unparse(
    tvDiary.map((d) => {
      const t = byRef.get(d.title)!;
      return {
        tmdbID: t.tmdbId,
        Title: t.title,
        Year: t.year ?? "",
        Season: d.season === null ? "Entire series" : d.season,
        FinishedDate: d.watchedOn ?? "",
        Rating10: d.rating ?? "",
        Review: reviewText(d.reviewHtml),
        Where: d.where ?? "",
      };
    }),
  );
  const watchlistCsv = Papa.unparse(
    backup.watchlist.map((w) => {
      const t = byRef.get(w.title)!;
      return { tmdbID: t.tmdbId, imdbID: t.imdbId ?? "", Title: t.title, Year: t.year ?? "", Type: t.mediaType, AddedAt: w.addedAt ?? "" };
    }),
  );

  return zipSync({
    [BACKUP_FILE]: strToU8(JSON.stringify(backup, null, 2)),
    "diary.csv": strToU8(diaryCsv),
    "tv-diary.csv": strToU8(tvCsv),
    "watchlist.csv": strToU8(watchlistCsv),
    "README.txt": strToU8(README),
  });
}

// ---------------------------------------------------------------------------
// Restore
// ---------------------------------------------------------------------------

export type RestoreResult = { added: number; skipped: number; watchlist: number; seenBefore: number; failed: string[] };

/**
 * Restores lists and tier lists. Safe to repeat: a list you already have (same name and kind) is skipped.
 * `titles` are the backup's titles these lists use.
 */
export async function restoreLists(db: DB, userId: number, backupLists: BackupList[], backupTitles: BackupTitle[]) {
  let added = 0;
  const failed: string[] = [];
  const existing = await db.select({ name: lists.name, kind: lists.kind }).from(lists).where(eq(lists.userId, userId));
  const titleIds = new Map<string, number>();
  await mapLimit(backupTitles, 6, async (t) => {
    try {
      titleIds.set(t.ref, await ensureTitle(db, t.tmdbId, t.mediaType));
    } catch {
      failed.push(t.title);
    }
  });
  for (const l of backupLists) {
    if (existing.some((e) => e.name === l.name && e.kind === l.kind)) continue;
    const tierIds = new Set(l.tiers.map((t) => t.id));
    const [row] = await db
      .insert(lists)
      .values({ userId, name: l.name, description: l.description, kind: l.kind, ranked: l.ranked, tiers: l.tiers, source: l.source })
      .returning({ id: lists.id });
    const seen = new Set<number>();
    const items = l.items
      .map((i, position) => ({ titleId: titleIds.get(i.title), tier: i.tier && tierIds.has(i.tier) ? i.tier : null, position }))
      .filter((i): i is { titleId: number; tier: string | null; position: number } => i.titleId !== undefined && !seen.has(i.titleId) && Boolean(seen.add(i.titleId)));
    if (items.length) await db.insert(listItems).values(items.map((i) => ({ listId: row.id, ...i })));
    added++;
  }
  return { added, failed };
}

/**
 * Merges part of a backup into an account. Safe to repeat: a diary entry is skipped when the account already has
 * that title + season on the same date (or an undated one), and import keys stop exact repeats.
 */
export async function restoreBatch(
  db: DB,
  userId: number,
  batch: Pick<Backup, "titles" | "diary" | "watchlist" | "seenBefore">,
): Promise<RestoreResult> {
  const result: RestoreResult = { added: 0, skipped: 0, watchlist: 0, seenBefore: 0, failed: [] };

  const titleIds = new Map<string, number>();
  await mapLimit(batch.titles, 6, async (t) => {
    try {
      titleIds.set(t.ref, await ensureTitle(db, t.tmdbId, t.mediaType));
    } catch {
      result.failed.push(t.title);
    }
  });

  // Same title runs in order (so only one entry ends up the main review); different titles run in parallel.
  const groups = [...Map.groupBy(batch.diary, (d) => d.title).values()];
  await mapLimit(groups, 6, async (entries) => {
    const titleId = titleIds.get(entries[0].title);
    if (!titleId) return;
    for (const d of entries) {
      const [duplicate] = await db
        .select({ id: viewings.id })
        .from(viewings)
        .where(
          and(
            eq(viewings.userId, userId),
            eq(viewings.titleId, titleId),
            d.season === null ? isNull(viewings.seasonNumber) : eq(viewings.seasonNumber, d.season),
            d.watchedOn === null ? isNull(viewings.watchedOn) : eq(viewings.watchedOn, d.watchedOn),
          ),
        )
        .limit(1);
      if (duplicate) {
        result.skipped++;
        continue;
      }
      const reviewHtml = cleanReview(d.reviewHtml);
      const [main] =
        reviewHtml && d.mainReview
          ? await db
              .select({ id: viewings.id })
              .from(viewings)
              .where(and(eq(viewings.userId, userId), eq(viewings.titleId, titleId), eq(viewings.isMainReview, true), isNotNull(viewings.reviewHtml)))
              .limit(1)
          : [];
      const createdAt = new Date(d.createdAt);
      const inserted = await db
        .insert(viewings)
        .values({
          userId,
          titleId,
          watchedOn: d.watchedOn,
          seasonNumber: d.season,
          rating: d.rating,
          liked: d.liked,
          isRewatch: d.rewatch,
          reviewHtml,
          isMainReview: Boolean(reviewHtml) && d.mainReview && !main,
          containsSpoilers: Boolean(reviewHtml) && d.spoilers,
          watchedWhere: d.where,
          format: d.format,
          watchedWith: d.with,
          tags: d.tags,
          importKey: d.importKey ?? `backup:${d.title}:${d.season ?? "-"}:${d.watchedOn ?? "undated"}:${d.createdAt}`,
          skipRating: d.skipRating ?? false,
          createdAt: Number.isNaN(createdAt.getTime()) ? new Date() : createdAt,
        })
        .onConflictDoNothing({ target: [viewings.userId, viewings.importKey] })
        .returning({ id: viewings.id });
      if (inserted.length) result.added++;
      else result.skipped++;
    }
  });

  // One insert for the whole batch (titles deduplicated, which Postgres needs for ON CONFLICT DO UPDATE).
  const watchlist = new Map<number, Date>();
  for (const w of batch.watchlist) {
    const titleId = titleIds.get(w.title);
    if (titleId) watchlist.set(titleId, w.addedAt ? new Date(w.addedAt) : new Date());
  }
  if (watchlist.size) {
    await db
      .insert(userTitles)
      .values([...watchlist].map(([titleId, watchlistedAt]) => ({ userId, titleId, onWatchlist: true, watchlistedAt })))
      .onConflictDoUpdate({
        target: [userTitles.userId, userTitles.titleId],
        set: { onWatchlist: true, watchlistedAt: sql`excluded.watchlisted_at` },
      });
    result.watchlist += watchlist.size;
  }

  const seenBefore = new Map<number, number>();
  for (const s of batch.seenBefore) {
    const titleId = titleIds.get(s.title);
    if (titleId) seenBefore.set(titleId, Math.max(s.count, seenBefore.get(titleId) ?? 0));
  }
  if (seenBefore.size) {
    await db
      .insert(userTitles)
      .values([...seenBefore].map(([titleId, priorWatchCount]) => ({ userId, titleId, priorWatchCount })))
      .onConflictDoUpdate({
        target: [userTitles.userId, userTitles.titleId],
        // Keep whichever count is higher: what's here already, or the backup's.
        set: { priorWatchCount: sql`greatest(${userTitles.priorWatchCount}, excluded.prior_watch_count)` },
      });
    result.seenBefore += seenBefore.size;
  }
  return result;
}
