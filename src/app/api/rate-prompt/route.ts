import { eq } from "drizzle-orm";
import { after } from "next/server";
import { getDb, plexConnections, users } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { syncPlex } from "@/lib/plex";
import { getNewPlexWatches, type RateItem } from "@/lib/rate-queue";

export type RatePromptResponse = { items: RateItem[]; total: number; checkedAt: string };

// Catch up on Plex when opening the site if the last sync is older than this…
const SYNC_AFTER_MS = 30 * 60_000;
// …but don't hold the pop-up back longer than this waiting for it.
const SYNC_WAIT_MS = 20_000;

/** Asked once per visit by the pop-up: syncs Plex if it's been a while, then returns new watches that need a rating. */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "signed out" }, { status: 401 });
  const nothing: RatePromptResponse = { items: [], total: 0, checkedAt: new Date().toISOString() };
  if (!user.ratePrompt) return Response.json(nothing);

  const db = await getDb();
  const [[me], [plex]] = await Promise.all([
    db.select({ seenAt: users.ratePromptSeenAt }).from(users).where(eq(users.id, user.id)),
    db.select({ lastSyncedAt: plexConnections.lastSyncedAt }).from(plexConnections).where(eq(plexConnections.userId, user.id)),
  ]);
  if (!plex) return Response.json(nothing);

  if (!plex.lastSyncedAt || Date.now() - plex.lastSyncedAt.getTime() > SYNC_AFTER_MS) {
    const sync = syncPlex(db, user.id).catch(() => null);
    // A slow sync keeps going after we answer; whatever it finds pops up next visit.
    after(() => sync);
    await Promise.race([sync, new Promise((resolve) => setTimeout(resolve, SYNC_WAIT_MS))]);
  }

  const checkedAt = new Date();
  const { items, total } = await getNewPlexWatches(user.id, me.seenAt);
  const body: RatePromptResponse = { items, total, checkedAt: checkedAt.toISOString() };
  return Response.json(body);
}
