import type { Metadata } from "next";
import { Suspense } from "react";
import { ImportWizard } from "@/components/import/import-wizard";
import { MissingKey } from "@/components/missing-key";
import { PageHeader } from "@/components/page";
import { getDb } from "@/db";
import { requireUser } from "@/lib/auth";
import { getPlexConnection } from "@/lib/plex";
import { hasTmdbKey } from "@/lib/tmdb";

/**
 * /settings/import — bring in history from Plex, Letterboxd, TMDB or Netflix, or restore a backup
 * (components/import/import-wizard.tsx).
 */

export const metadata: Metadata = { title: "Import" };

async function ImportGate({ searchParams }: { searchParams: PageProps<"/settings/import">["searchParams"] }) {
  const user = await requireUser("/settings/import");
  const [{ source }, plex] = await Promise.all([searchParams, getPlexConnection(await getDb(), user.id)]);
  return (
    <div className="px-4 sm:px-8 lg:px-12">
      <ImportWizard plexConnected={Boolean(plex?.serverUri)} highlightPlex={source === "plex"} />
    </div>
  );
}

export default function ImportPage(props: PageProps<"/settings/import">) {
  if (!hasTmdbKey()) return <MissingKey />;
  return (
    <>
      <PageHeader title="Import your history" subtitle="Bring in your Plex history, Letterboxd diary, and TMDB ratings. You'll review everything before it's saved." />
      <Suspense fallback={<div className="min-h-[40vh]" />}>
        <ImportGate searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
