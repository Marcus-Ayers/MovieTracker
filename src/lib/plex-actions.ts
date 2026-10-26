"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getDb, plexConnections } from "@/db";
import { requireUser } from "./auth";
import type { ImportRow } from "./import-parse";
import {
  buildPlexRows,
  checkPin,
  createPin,
  getAccounts,
  getOrCreatePlexConnection,
  getPlexConnection,
  listServers,
  pickConnection,
  plexAuthUrl,
  serverConn,
  syncPlex,
} from "./plex";

const validTimeZone = (tz: string) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
};

/** Step 1: create a Plex PIN and return the Plex sign-in URL to open. */
export async function startPlexLink(): Promise<{ url: string }> {
  const user = await requireUser("/settings");
  const db = await getDb();
  const conn = await getOrCreatePlexConnection(db, user.id);
  const pin = await createPin(conn.clientId);
  await db.update(plexConnections).set({ pendingPinId: pin.id }).where(eq(plexConnections.userId, user.id));
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
  return { url: plexAuthUrl(conn.clientId, pin.code, `${origin}/plex/linked`) };
}

export type LinkStatus =
  | { status: "waiting" }
  | { status: "connected"; serverName: string }
  | { status: "error"; message: string };

/** Step 2 (polled): once you've approved the PIN, find your server and save the connection. */
export async function finishPlexLink(timeZone: string): Promise<LinkStatus> {
  const user = await requireUser("/settings");
  const db = await getDb();
  const conn = await getPlexConnection(db, user.id);
  // Another tab may have finished the sign-in already.
  if (!conn?.pendingPinId && conn?.serverUri) return { status: "connected", serverName: conn.serverName ?? "Plex" };
  if (!conn?.pendingPinId) return { status: "error", message: "Start the Plex sign-in again." };
  const token = await checkPin(conn.clientId, conn.pendingPinId);
  if (!token) return { status: "waiting" };

  const servers = (await listServers(conn.clientId, token)).sort((a, b) => Number(b.owned) - Number(a.owned));
  if (!servers.length) return { status: "error", message: "No Plex Media Server found on your account." };
  for (const server of servers) {
    const uri = await pickConnection(server, conn.clientId);
    if (!uri) continue;
    const accounts = await getAccounts({ uri, token: server.accessToken, clientId: conn.clientId }).catch(() => []);
    // The server owner is always account 1.
    const account = accounts.find((a) => a.id === 1) ?? accounts[0];
    await db
      .update(plexConnections)
      .set({
        authToken: token,
        pendingPinId: null,
        serverName: server.name,
        serverId: server.id,
        serverToken: server.accessToken,
        serverUri: uri,
        accountId: account?.id ?? 1,
        accountName: account?.name ?? null,
        timeZone: validTimeZone(timeZone),
      })
      .where(eq(plexConnections.userId, user.id));
    revalidatePath("/settings");
    return { status: "connected", serverName: server.name };
  }
  return {
    status: "error",
    message: "Found your Plex server but couldn't reach it. Make sure it's running and Remote Access is enabled.",
  };
}

export async function setPlexAccount(accountId: number) {
  const user = await requireUser("/settings");
  const db = await getDb();
  const conn = await getPlexConnection(db, user.id);
  const sc = conn && serverConn(conn);
  if (!sc) return;
  const account = (await getAccounts(sc)).find((a) => a.id === accountId);
  if (!account) return;
  await db.update(plexConnections).set({ accountId: account.id, accountName: account.name }).where(eq(plexConnections.userId, user.id));
  revalidatePath("/settings");
}

export async function disconnectPlex() {
  const user = await requireUser("/settings");
  const db = await getDb();
  await db.delete(plexConnections).where(eq(plexConnections.userId, user.id));
  revalidatePath("/settings");
}

/** For the import page: your whole Plex history as reviewable rows. */
export async function getPlexImportRows(timeZone: string): Promise<{ rows: ImportRow[]; notes: string[] } | { error: string }> {
  const user = await requireUser("/settings/import");
  const db = await getDb();
  const conn = await getPlexConnection(db, user.id);
  if (!conn || !serverConn(conn)) return { error: "Connect Plex in Settings first." };
  await db.update(plexConnections).set({ timeZone: validTimeZone(timeZone) }).where(eq(plexConnections.userId, user.id));
  try {
    return await buildPlexRows(db, { ...conn, timeZone: validTimeZone(timeZone) });
  } catch (e) {
    return { error: (e as Error).message };
  }
}

/** "Sync now": save any new Plex plays without a review step. */
export async function syncPlexNow(): Promise<{ message: string }> {
  const user = await requireUser("/settings");
  const db = await getDb();
  try {
    const result = await syncPlex(db, user.id);
    revalidatePath("/", "layout");
    return { message: result ? `${result.summary}.` : "Plex isn't connected." };
  } catch (e) {
    return { message: `Sync failed: ${(e as Error).message}` };
  }
}
