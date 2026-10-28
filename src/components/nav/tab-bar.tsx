"use client";

import {
  BookOpen,
  Bookmark,
  ChartColumn,
  Clapperboard,
  Compass,
  Film,
  House,
  LayoutList,
  Library,
  LogIn,
  Plus,
  Search,
  Settings,
  Sparkles,
  Star,
  Tv,
  UserRound,
  Users,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import type { MyTitle } from "@/app/api/my-title/route";
import type { QuickSearchResult } from "@/app/api/search/route";
import { cn, MEDIA_LABEL, tmdbImage } from "@/lib/format";
import { LogDialog, type LogTarget } from "../log/log-button";
import { Modal } from "../ui/modal";

export type TabBarUser = { username: string; displayName: string; social: boolean; requests: number } | null;

// Pages that belong to the "You" tab.
const YOU_PAGES = ["/library", "/watchlist", "/stats", "/lists", "/friends", "/recap", "/rate", "/settings", "/u/"];

function Tab({ href, icon, label, active, onClick }: { href?: string; icon: ReactNode; label: string; active: boolean; onClick?: () => void }) {
  const className = cn("flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium", active ? "text-fg" : "text-dim");
  const body = (
    <>
      {icon}
      {label}
    </>
  );
  return href ? (
    <Link href={href} className={className} aria-current={active ? "page" : undefined}>
      {body}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={className}>
      {body}
    </button>
  );
}

function MenuTile({ href, icon, label, badge, onClick }: { href: string; icon: ReactNode; label: string; badge?: number; onClick: () => void }) {
  return (
    <Link href={href} onClick={onClick} className="relative flex flex-col items-center gap-1.5 rounded-xl bg-surface-2 px-2 py-3.5 text-center text-xs font-medium">
      {icon}
      {label}
      {badge ? <span className="absolute right-2 top-2 rounded-full bg-accent px-1.5 text-[10px] font-bold leading-4 text-white">{badge}</span> : null}
    </Link>
  );
}

/** Everything that isn't a tab: your pages, browsing, settings. */
function YouSheet({ user, open, onClose }: { user: TabBarUser; open: boolean; onClose: () => void }) {
  const icon = "size-6 text-muted";
  return (
    <Modal open={open} onClose={onClose} label="Menu">
      <div className="space-y-5 p-5">
        {user ? (
          <Link href={`/u/${user.username}`} onClick={onClose} className="flex items-center gap-3 pr-10">
            <span className="grid size-11 place-items-center rounded-full bg-accent text-lg font-bold uppercase text-white">{user.displayName.trim()[0] ?? "?"}</span>
            <span>
              <span className="block font-semibold">{user.displayName}</span>
              <span className="block text-sm text-dim">@{user.username} · your public profile</span>
            </span>
          </Link>
        ) : (
          <div className="pr-10">
            <p className="font-semibold">Keep a diary of everything you watch</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Link href="/sign-in" onClick={onClose} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-accent font-semibold text-white">
                <LogIn className="size-4" /> Sign in
              </Link>
              <Link href="/sign-up" onClick={onClose} className="inline-flex h-11 items-center justify-center rounded-lg border border-line font-semibold">
                Create account
              </Link>
            </div>
          </div>
        )}
        {user && (
          <div className="grid grid-cols-3 gap-2">
            <MenuTile href="/library" icon={<Library className={icon} />} label="Library" onClick={onClose} />
            <MenuTile href="/watchlist" icon={<Bookmark className={icon} />} label="Watchlist" onClick={onClose} />
            <MenuTile href="/stats" icon={<ChartColumn className={icon} />} label="Stats" onClick={onClose} />
            <MenuTile href="/lists" icon={<LayoutList className={icon} />} label="Lists" onClick={onClose} />
            {user.social && <MenuTile href="/friends" icon={<Users className={icon} />} label="Friends" badge={user.requests} onClick={onClose} />}
            <MenuTile href="/recap" icon={<Sparkles className={icon} />} label="Year in review" onClick={onClose} />
            <MenuTile href="/rate" icon={<Star className={icon} />} label="Rate" onClick={onClose} />
            <MenuTile href="/settings" icon={<Settings className={icon} />} label="Settings" onClick={onClose} />
          </div>
        )}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-dim">Browse</p>
          <div className="grid grid-cols-4 gap-2">
            <MenuTile href="/movies" icon={<Film className={icon} />} label="Movies" onClick={onClose} />
            <MenuTile href="/tv" icon={<Tv className={icon} />} label="TV" onClick={onClose} />
            <MenuTile href="/explore" icon={<Compass className={icon} />} label="Explore" onClick={onClose} />
            <MenuTile href="/lists" icon={<Clapperboard className={icon} />} label="Lists" onClick={onClose} />
          </div>
        </div>
      </div>
    </Modal>
  );
}

type Hit = QuickSearchResult["items"][number];

/** ＋ Log: find something and log it in two taps. */
function QuickLog({ user, open, onClose }: { user: TabBarUser; open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<{ query: string; items: Hit[] } | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [target, setTarget] = useState<{ target: LogTarget; mine: Extract<MyTitle, { loggedIn: true }> } | null>(null);
  const q = query.trim();
  const items = found && found.query === q ? found.items : [];

  useEffect(() => {
    if (q.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal })
        .then((res) => res.json() as Promise<QuickSearchResult>)
        .then((data) => setFound({ query: q, items: data.items }))
        .catch(() => {});
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q]);

  const pick = async (hit: Hit) => {
    setOpening(`${hit.mediaType}-${hit.id}`);
    const mine = (await fetch(`/api/my-title?type=${hit.mediaType}&id=${hit.id}`)
      .then((res) => res.json())
      .catch(() => null)) as MyTitle | null;
    setOpening(null);
    if (!mine?.loggedIn) return;
    onClose();
    setQuery("");
    setTarget({
      target: { tmdbId: hit.id, mediaType: hit.mediaType, title: hit.title, year: hit.year, posterPath: hit.posterPath, seasons: mine.seasons },
      mine,
    });
  };

  return (
    <>
      <Modal open={open} onClose={onClose} label="Log something">
        <div className="p-5">
          <h2 className="mb-3 pr-10 text-lg font-bold">What did you watch?</h2>
          {user ? (
            <>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-dim" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search movies and shows"
                  autoFocus
                  enterKeyHint="search"
                  className="h-12 w-full rounded-lg border border-line bg-bg pl-9 pr-3 outline-none focus:border-fg/50"
                />
              </div>
              <ul className="mt-2 min-h-40">
                {items.map((hit) => {
                  const key = `${hit.mediaType}-${hit.id}`;
                  return (
                    <li key={key}>
                      <button
                        type="button"
                        disabled={opening !== null}
                        onClick={() => pick(hit)}
                        className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left active:bg-surface-3 disabled:opacity-60"
                      >
                        <span className="relative h-16 w-11 shrink-0 overflow-hidden rounded bg-surface-3">
                          {hit.posterPath && <Image src={tmdbImage(hit.posterPath, "w92")!} alt="" fill sizes="44px" className="object-cover" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{hit.title}</span>
                          <span className="block text-sm text-dim">{[hit.year, MEDIA_LABEL[hit.mediaType]].filter(Boolean).join(" · ")}</span>
                        </span>
                        <span className="text-sm font-semibold text-accent">{opening === key ? "…" : "Log"}</span>
                      </button>
                    </li>
                  );
                })}
                {q.length < 2 && (
                  <li className="pt-4">
                    <Link href="/rate" onClick={onClose} className="flex items-center gap-3 rounded-lg bg-surface-2 p-3 text-sm">
                      <Star className="size-5 text-gold" />
                      <span>
                        <span className="block font-medium">Rate what you&apos;ve watched</span>
                        <span className="block text-dim">New Plex watches and anything without a rating</span>
                      </span>
                    </Link>
                  </li>
                )}
              </ul>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <p className="col-span-2 mb-1 text-sm text-muted">Sign in to log what you watch.</p>
              <Link href="/sign-in" onClick={onClose} className="inline-flex h-11 items-center justify-center rounded-lg bg-accent font-semibold text-white">
                Sign in
              </Link>
              <Link href="/sign-up" onClick={onClose} className="inline-flex h-11 items-center justify-center rounded-lg border border-line font-semibold">
                Create account
              </Link>
            </div>
          )}
        </div>
      </Modal>
      {target && <LogDialog open onClose={() => setTarget(null)} target={target.target} history={target.mine.history} />}
    </>
  );
}

/** The phone tab bar: Home, Search, ＋ Log, Diary, and You (everything else). Hidden on wider screens. */
export function TabBar({ user }: { user: TabBarUser }) {
  const pathname = usePathname();
  const [sheet, setSheet] = useState<"log" | "you" | null>(null);
  const youActive = YOU_PAGES.some((p) => pathname.startsWith(p));
  const icon = "size-6";

  return (
    <>
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <div className="grid h-16 grid-cols-5">
          <Tab href="/" icon={<House className={icon} />} label="Home" active={pathname === "/"} />
          <Tab href="/search" icon={<Search className={icon} />} label="Search" active={pathname.startsWith("/search")} />
          <button type="button" onClick={() => setSheet("log")} aria-label="Log something" className="grid place-items-center">
            <span className="grid size-12 place-items-center rounded-full bg-accent text-white shadow-lg shadow-accent/30 active:scale-95">
              <Plus className="size-7" strokeWidth={2.5} />
            </span>
          </button>
          <Tab href="/diary" icon={<BookOpen className={icon} />} label="Diary" active={pathname.startsWith("/diary")} />
          <Tab
            icon={
              <span className="relative">
                <UserRound className={icon} />
                {user && user.requests > 0 && <span className="absolute -right-1 -top-0.5 size-2.5 rounded-full bg-accent ring-2 ring-bg" />}
              </span>
            }
            label="You"
            active={youActive}
            onClick={() => setSheet("you")}
          />
        </div>
      </nav>
      <QuickLog user={user} open={sheet === "log"} onClose={() => setSheet(null)} />
      <YouSheet user={user} open={sheet === "you"} onClose={() => setSheet(null)} />
    </>
  );
}

/** Same bar while the page is still working out who you are, so nothing jumps. */
export function TabBarPlaceholder() {
  return <div aria-hidden className="fixed inset-x-0 bottom-0 z-40 h-[var(--tabbar-h)] border-t border-line bg-bg/95 md:hidden" />;
}
