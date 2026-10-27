"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb, users } from "@/db";
import { requireUser } from "./auth";
import { restoreBatch, type RestoreResult } from "./backup";
import { backupDiaryEntry, backupProfile, backupSeenBefore, backupTitle, backupWatchlistItem } from "./backup-format";

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

/** Optional: bring back display name, privacy, and the hide-watched preference. */
export async function restoreProfileSettings(profile: z.infer<typeof backupProfile>) {
  const user = await requireUser("/settings/import");
  const p = backupProfile.parse(profile);
  const db = await getDb();
  await db
    .update(users)
    .set({
      displayName: p.displayName.trim() || user.displayName,
      visibility: p.visibility,
      hideWatched: p.hideWatched,
      ...(p.ratePrompt === undefined ? {} : { ratePrompt: p.ratePrompt }),
      ...(p.streamingServices === undefined ? {} : { streamingServices: p.streamingServices }),
      ...(p.social === undefined ? {} : { social: p.social }),
      ...(p.socialHome === undefined ? {} : { socialHome: p.socialHome }),
      ...(p.socialTitles === undefined ? {} : { socialTitles: p.socialTitles }),
      ...(p.friendRequests === undefined ? {} : { friendRequests: p.friendRequests }),
    })
    .where(eq(users.id, user.id));
}

export async function finishRestore() {
  await requireUser("/settings/import");
  revalidatePath("/", "layout");
}
