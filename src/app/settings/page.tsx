import { formatDistanceToNow } from "date-fns";
import type { Metadata } from "next";
import { Suspense } from "react";
import { DeleteAccountCard } from "@/components/delete-account-card";
import { PageHeader } from "@/components/page";
import { PlexCard, type PlexCardData } from "@/components/plex-card";
import { RatingsCard } from "@/components/ratings-card";
import { SettingsForm } from "@/components/settings-form";
import { isSiteAdmin, requireUser } from "@/lib/auth";
import { getDb } from "@/db";
import { getAccounts, getPlexConnection, serverConn } from "@/lib/plex";
import { getRatingsStatus } from "@/lib/ratings";
import { getStreamingServiceChoices, hasTmdbKey } from "@/lib/tmdb";

/**
 * /settings — profile and privacy, social switches, streaming services, Plex, ratings data, install instructions,
 * and deleting your account.
 */

export const metadata: Metadata = { title: "Settings" };

async function loadPlex(userId: number): Promise<PlexCardData> {
  const conn = await getPlexConnection(await getDb(), userId);
  const sc = conn && serverConn(conn);
  if (!conn || !sc) return { connected: false };
  const accounts = await getAccounts(sc).catch(() => null);
  return {
    connected: true,
    serverName: conn.serverName ?? "Plex",
    accountId: conn.accountId,
    accounts: accounts ?? (conn.accountId ? [{ id: conn.accountId, name: conn.accountName ?? "You" }] : []),
    lastSync: conn.lastSyncedAt ? formatDistanceToNow(conn.lastSyncedAt, { addSuffix: true }) : null,
    summary: conn.lastSyncSummary,
    reachable: accounts !== null,
  };
}

async function Settings() {
  const user = await requireUser("/settings");
  const [s, plex, admin, serviceChoices] = await Promise.all([
    getRatingsStatus(user.id),
    loadPlex(user.id),
    isSiteAdmin(user.id),
    hasTmdbKey() ? getStreamingServiceChoices().catch(() => null) : null,
  ]);
  const ago = (d: Date | null) => (d ? `updated ${formatDistanceToNow(d, { addSuffix: true })}` : "never updated");
  return (
    <div className="max-w-2xl space-y-10 px-4 sm:px-8 lg:px-12">
      <SettingsForm
        displayName={user.displayName}
        username={user.username}
        visibility={user.visibility}
        hideWatched={user.hideWatched}
        ratePrompt={user.ratePrompt}
        streamingServices={user.streamingServices}
        serviceChoices={serviceChoices}
        social={user.social}
        socialHome={user.socialHome}
        socialTitles={user.socialTitles}
        friendRequests={user.friendRequests}
      />
      <PlexCard data={plex} />
      <RatingsCard
        data={{
          imdbLine: s.imdbTitles ? `${s.imdbTitles.toLocaleString()} titles · ${ago(s.imdbSyncedAt)}` : "Not downloaded yet",
          rtLine: `${s.omdbScores.toLocaleString()} titles · ${s.backfillRanAt ? `backfill ran ${formatDistanceToNow(s.backfillRanAt, { addSuffix: true })}` : "backfill hasn't run yet"}`,
          libraryLine: `IMDb for ${s.libraryWithImdb.toLocaleString()} of ${s.libraryTitles.toLocaleString()} · Rotten Tomatoes checked for ${s.libraryRtChecked.toLocaleString()}`,
          libraryPct: s.libraryTitles ? Math.round((s.libraryRtChecked / s.libraryTitles) * 100) : 0,
          omdbUsed: s.omdbCallsToday,
          omdbLimit: s.omdbLimit,
          hasOmdbKey: s.hasOmdbKey,
          canRunNow: admin,
        }}
      />
      <section className="rounded-xl border border-line bg-surface p-6">
        <h2 className="mb-1 font-semibold">Install on your iPhone</h2>
        <p className="text-sm text-muted">
          Open this site in Safari, tap Share (under ••• on newer iPhones), then <span className="text-fg">Add to Home Screen</span>. It gets its own
          icon and opens full screen, like an app. Sign in once inside it; it doesn&apos;t share Safari&apos;s sign-in.
        </p>
      </section>
      <DeleteAccountCard username={user.username} />
    </div>
  );
}

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" />
      <Suspense fallback={<div className="min-h-[40vh]" />}>
        <Settings />
      </Suspense>
    </>
  );
}
