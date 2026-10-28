"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb, users } from "@/db";
import { requireUser } from "./auth";
import { restoreBatch, restoreLists, type RestoreResult } from "./backup";
import { backupDiaryEntry, backupList, backupProfile, backupSeenBefore, backupTitle, backupWatchlistItem } from "./backup-format";

/**
 * Server actions for restoring a backup (Settings → Import → drop the export ZIP). The browser unzips and checks
 * the file, then sends it here a slice at a time so the page can show progress; the real work is in backup.ts.
 */

const batchSchema = z.object({
  titles: z.array(backupTitle).max(300),
  diary: z.array(backupDiaryEntry).max(150),
  watchlist: z.array(backupWatchlistItem).max(300),
  seenBefore: z.array(backupSeenBefore).max(300),
});

/** Restores one slice of a backup. The import page sends slices so it can show progress. */
export async function restoreBackupBatch(batch: z.infer<typeof batchSchema>): Promise<RestoreResult> {
  const user = await requireUser("/settings/import");
  const db = await getDb();
  return restoreBatch(db, user.id, batchSchema.parse(batch));
}

/** Restores a few lists at a time, with the titles they use. */
export async function restoreBackupLists(batch: { lists: z.infer<typeof backupList>[]; titles: z.infer<typeof backupTitle>[] }) {
  const user = await requireUser("/settings/import");
  const parsed = z.object({ lists: z.array(backupList).max(20), titles: z.array(backupTitle).max(2000) }).parse(batch);
  const db = await getDb();
  return restoreLists(db, user.id, parsed.lists, parsed.titles);
}

/** Optional: bring back your display name and settings (privacy, social, browsing, streaming services, pop-ups). */
export async function restoreProfileSettings(profile: z.infer<typeof backupProfile>) {
  const user = await requireUser("/settings/import");
  // Your username stays as it is (it may belong to someone else here). Settings an older backup doesn't have are
  // undefined, and Drizzle leaves undefined fields alone, so they keep their current values.
  const { displayName, ...settings } = backupProfile.omit({ username: true }).parse(profile);
  const db = await getDb();
  await db
    .update(users)
    .set({ ...settings, displayName: displayName.trim() || user.displayName })
    .where(eq(users.id, user.id));
}

/** Called after the last slice of a restore: refreshes every page so the restored data shows up. */
export async function finishRestore() {
  await requireUser("/settings/import");
  revalidatePath("/", "layout");
}
