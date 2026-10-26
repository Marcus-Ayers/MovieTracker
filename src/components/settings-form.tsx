"use client";

import { Globe, Lock, Upload, Users } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import type { Visibility } from "@/db/schema";
import { logout, updateSettings, type ActionState } from "@/lib/actions";
import { cn } from "@/lib/format";
import { submitTo } from "@/lib/forms";

const VISIBILITY: { value: Visibility; label: string; description: string; icon: React.ReactNode }[] = [
  { value: "everyone", label: "Everyone", description: "Anyone with the link can see your library, diary, reviews, and stats.", icon: <Globe className="size-5" /> },
  { value: "friends", label: "Friends", description: "Only friends can see them. (Friends are coming later — until then this acts like Private.)", icon: <Users className="size-5" /> },
  { value: "private", label: "Only me", description: "Your diary, reviews, and stats are hidden from everyone else.", icon: <Lock className="size-5" /> },
];

export function SettingsForm({
  displayName,
  username,
  visibility,
  hideWatched,
}: {
  displayName: string;
  username: string;
  visibility: Visibility;
  hideWatched: boolean;
}) {
  const [state, action, pending] = useActionState(updateSettings, { ok: false } as ActionState);
  return (
    <div className="max-w-2xl space-y-10">
      <form onSubmit={submitTo(action)} className="space-y-8">
        <section className="rounded-xl border border-line bg-surface p-6">
          <h2 className="mb-4 font-semibold">Profile</h2>
          <label className="block">
            <span className="mb-1.5 block text-sm text-muted">Display name</span>
            <input
              name="displayName"
              defaultValue={displayName}
              required
              maxLength={60}
              className="h-11 w-full rounded-md border border-line bg-bg px-3 outline-none focus:border-fg/50"
            />
          </label>
          <p className="mt-2 text-xs text-dim">Signed in as @{username}</p>
        </section>

        <section className="rounded-xl border border-line bg-surface p-6">
          <h2 className="mb-1 font-semibold">Who can see your profile</h2>
          <p className="mb-4 text-sm text-muted">Browsing movies and shows is always public. This controls your personal pages.</p>
          <div className="space-y-2">
            {VISIBILITY.map((option) => (
              <label key={option.value} className="block cursor-pointer">
                <input type="radio" name="visibility" value={option.value} defaultChecked={visibility === option.value} className="peer sr-only" />
                <span
                  className={cn(
                    "flex gap-4 rounded-lg border border-line p-4 transition hover:border-fg/30",
                    "peer-checked:border-accent peer-checked:bg-accent/10 peer-focus-visible:ring-2 peer-focus-visible:ring-fg",
                  )}
                >
                  <span className="mt-0.5 text-muted">{option.icon}</span>
                  <span>
                    <span className="block font-medium">{option.label}</span>
                    <span className="block text-sm text-muted">{option.description}</span>
                  </span>
                </span>
              </label>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-line bg-surface p-6">
          <h2 className="mb-4 font-semibold">Browsing</h2>
          <label className="flex cursor-pointer items-start gap-3">
            <input type="checkbox" name="hideWatched" defaultChecked={hideWatched} className="mt-1 size-4 accent-accent" />
            <span>
              <span className="block">Hide things I&apos;ve already watched</span>
              <span className="block text-sm text-muted">Applies to browse rows. Top 10 lists always show everything. You can also toggle this on the home page.</span>
            </span>
          </label>
        </section>

        <div className="flex items-center gap-4">
          <button disabled={pending} className="rounded bg-accent px-6 py-2.5 font-semibold text-white hover:bg-accent-hover disabled:opacity-60">
            {pending ? "Saving…" : "Save settings"}
          </button>
          {state.error && <p className="text-sm text-accent">{state.error}</p>}
          {state.ok && !pending && <p className="text-sm text-muted">Saved.</p>}
        </div>
      </form>

      <section className="rounded-xl border border-line bg-surface p-6">
        <h2 className="mb-1 font-semibold">Import your history</h2>
        <p className="mb-4 text-sm text-muted">Bring in your Letterboxd diary and reviews, and your TMDB ratings.</p>
        <Link href="/settings/import" className="inline-flex items-center gap-2 rounded border border-line px-4 py-2 text-sm hover:border-fg/40">
          <Upload className="size-4" /> Import from Letterboxd or TMDB
        </Link>
      </section>

      <form action={logout}>
        <button className="rounded border border-line px-5 py-2 text-sm text-muted hover:border-fg/40 hover:text-fg">Sign out</button>
      </form>
    </div>
  );
}
