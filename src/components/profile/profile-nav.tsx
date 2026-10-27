import { Link2, LogIn } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Notice, PrivateNotice } from "@/components/page";
import { getProfileAccess, getSignInState, type CurrentUser } from "@/lib/auth";
import { cn } from "@/lib/format";

/** Whose library/diary/stats/watchlist a view shows, and where its links point. */
export type ProfileViewProps = {
  profile: CurrentUser;
  /** The viewer is looking at their own data. */
  isOwn: boolean;
  /** "" for your own pages (/library), "/u/username" for a public profile (/u/username/library). */
  base: string;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const profileBase = (username: string) => `/u/${username}`;

/** For /u/[username]/… pages: whose profile to show, or the notice to show instead when it's private. */
export async function openProfile(params: Promise<{ username: string }>): Promise<{ view: Omit<ProfileViewProps, "searchParams"> } | { notice: ReactNode }> {
  const access = await getProfileAccess((await params).username);
  if (access.status === "not-found") notFound();
  if (access.status === "private") return { notice: <PrivateNotice name={access.profile.displayName} /> };
  return { view: { profile: access.profile, isOwn: access.isOwn, base: profileBase(access.profile.username) } };
}

export type ProfileSection = "library" | "diary" | "stats" | "watchlist";

const SECTIONS: { value: ProfileSection; label: string }[] = [
  { value: "library", label: "Library" },
  { value: "diary", label: "Diary" },
  { value: "stats", label: "Stats" },
  { value: "watchlist", label: "Watchlist" },
];

/** Tabs across someone's public profile. */
export function ProfileTabs({ profile, base, active }: { profile: CurrentUser; base: string; active: ProfileSection }) {
  return (
    <nav className="no-scrollbar -mt-2 mb-6 flex items-center gap-2 overflow-x-auto px-4 sm:px-8 lg:px-12">
      <span className="mr-2 shrink-0 text-sm text-dim">@{profile.username}</span>
      {SECTIONS.map((s) => (
        <Link
          key={s.value}
          href={`${base}/${s.value}`}
          className={cn(
            "shrink-0 rounded-full border px-3.5 py-1.5 text-sm transition",
            s.value === active ? "border-fg bg-fg text-bg" : "border-line text-muted hover:text-fg",
          )}
        >
          {s.label}
        </Link>
      ))}
    </nav>
  );
}

/** Shown on /library, /diary, /stats and /watchlist to visitors who aren't signed in. */
export async function SignInNotice({ section }: { section: ProfileSection }) {
  if ((await getSignInState()) === "needs-link") {
    return (
      <Notice icon={<Link2 className="size-6" />} title="Finish setting up your account">
        <p className="mb-6">Link your existing account or start a fresh one, then your {section} shows up here.</p>
        <Link href="/account" className="rounded bg-accent px-5 py-2.5 font-semibold text-white hover:bg-accent-hover">
          Continue
        </Link>
      </Notice>
    );
  }
  return (
    <Notice icon={<LogIn className="size-6" />} title={`Sign in to see your ${section}`}>
      <p className="mb-6">Everyone gets their own diary, library, stats and watchlist. Browsing movies and shows works without an account.</p>
      <div className="flex justify-center gap-3">
        <Link href={`/sign-in?redirect_url=/${section}`} className="rounded bg-accent px-5 py-2.5 font-semibold text-white hover:bg-accent-hover">
          Sign in
        </Link>
        <Link href={`/sign-up?redirect_url=/${section}`} className="rounded border border-line px-5 py-2.5 font-semibold text-fg hover:border-fg/40">
          Create account
        </Link>
      </div>
    </Notice>
  );
}
