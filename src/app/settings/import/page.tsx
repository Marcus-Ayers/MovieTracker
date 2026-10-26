import type { Metadata } from "next";
import { Suspense } from "react";
import { ImportWizard } from "@/components/import/import-wizard";
import { MissingKey } from "@/components/missing-key";
import { PageHeader } from "@/components/page";
import { requireUser } from "@/lib/auth";
import { hasTmdbKey } from "@/lib/tmdb";

export const metadata: Metadata = { title: "Import" };

async function ImportGate() {
  await requireUser("/settings/import");
  return (
    <div className="px-4 sm:px-8 lg:px-12">
      <ImportWizard />
    </div>
  );
}

export default function ImportPage() {
  if (!hasTmdbKey()) return <MissingKey />;
  return (
    <>
      <PageHeader title="Import your history" subtitle="Bring in your Letterboxd diary and your TMDB ratings. You'll review everything before it's saved." />
      <Suspense fallback={<div className="min-h-[40vh]" />}>
        <ImportGate />
      </Suspense>
    </>
  );
}
