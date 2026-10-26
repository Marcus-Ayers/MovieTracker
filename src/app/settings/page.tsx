import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/page";
import { SettingsForm } from "@/components/settings-form";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Settings" };

async function Settings() {
  const user = await requireUser("/settings");
  return (
    <div className="px-4 sm:px-8 lg:px-12">
      <SettingsForm displayName={user.displayName} username={user.username} visibility={user.visibility} hideWatched={user.hideWatched} />
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
