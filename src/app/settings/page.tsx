import { formatDistanceToNow } from "date-fns";
import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/page";
import { RatingsCard } from "@/components/ratings-card";
import { SettingsForm } from "@/components/settings-form";
import { requireUser } from "@/lib/auth";
import { getRatingsStatus } from "@/lib/ratings";

export const metadata: Metadata = { title: "Settings" };

async function Settings() {
  const user = await requireUser("/settings");
  const s = await getRatingsStatus(user.id);
  const ago = (d: Date | null) => (d ? `updated ${formatDistanceToNow(d, { addSuffix: true })}` : "never updated");
  return (
    <div className="max-w-2xl space-y-10 px-4 sm:px-8 lg:px-12">
      <SettingsForm displayName={user.displayName} username={user.username} visibility={user.visibility} hideWatched={user.hideWatched} />
      <RatingsCard
        data={{
          imdbLine: s.imdbTitles ? `${s.imdbTitles.toLocaleString()} titles · ${ago(s.imdbSyncedAt)}` : "Not downloaded yet",
          rtLine: `${s.omdbScores.toLocaleString()} titles · ${s.backfillRanAt ? `backfill ran ${formatDistanceToNow(s.backfillRanAt, { addSuffix: true })}` : "backfill hasn't run yet"}`,
          libraryLine: `IMDb for ${s.libraryWithImdb.toLocaleString()} of ${s.libraryTitles.toLocaleString()} · Rotten Tomatoes checked for ${s.libraryRtChecked.toLocaleString()}`,
          libraryPct: s.libraryTitles ? Math.round((s.libraryRtChecked / s.libraryTitles) * 100) : 0,
          omdbUsed: s.omdbCallsToday,
          omdbLimit: s.omdbLimit,
          hasOmdbKey: s.hasOmdbKey,
        }}
      />
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
