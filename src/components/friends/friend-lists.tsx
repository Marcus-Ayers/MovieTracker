import { Heart, Repeat } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn, formatDate, seasonLabel, titleHref, tmdbImage } from "@/lib/format";
import type { FriendActivity, Person } from "@/lib/friends";
import { ReviewBody } from "../title/review-body";

const AVATAR_COLORS = ["bg-accent/80", "bg-gold/80 text-black", "bg-tv/80", "bg-emerald-600", "bg-sky-600", "bg-fuchsia-600"];

/** A letter avatar (the site doesn't store profile photos). */
export function Avatar({ person, className }: { person: Person; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-full text-sm font-bold uppercase text-white",
        AVATAR_COLORS[person.id % AVATAR_COLORS.length],
        className,
      )}
    >
      {person.displayName.trim()[0] ?? "?"}
    </span>
  );
}

export function PersonRow({ person, children }: { person: Person; children?: ReactNode }) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <Avatar person={person} />
      <Link href={`/u/${person.username}`} className="min-w-0 flex-1 hover:underline hover:decoration-accent hover:underline-offset-4">
        <span className="block truncate font-medium">{person.displayName}</span>
        <span className="block truncate text-xs text-dim">@{person.username}</span>
      </Link>
      {children}
    </li>
  );
}

/** "Alex watched Heat · 9/10", newest first. */
export function ActivityList({ items }: { items: FriendActivity[] }) {
  return (
    <ol className="divide-y divide-line/60">
      {items.map(({ person, viewing: v, title: t }) => {
        const poster = tmdbImage(t.posterPath, "w92");
        return (
          <li key={v.id} className="flex gap-4 py-4">
            <Link href={titleHref(t.mediaType, t.tmdbId)} className="relative h-[72px] w-12 shrink-0 overflow-hidden rounded bg-surface-2">
              {poster && <Image src={poster} alt="" fill sizes="48px" className="object-cover" />}
            </Link>
            <div className="min-w-0 flex-1">
              <p className="leading-snug">
                <Link href={`/u/${person.username}`} className="font-semibold hover:underline">
                  {person.displayName}
                </Link>{" "}
                <span className="text-muted">{v.isRewatch ? "rewatched" : "watched"}</span>{" "}
                <Link href={titleHref(t.mediaType, t.tmdbId)} className="font-semibold hover:underline hover:decoration-accent hover:underline-offset-4">
                  {t.title}
                </Link>
                {t.mediaType === "tv" && <span className="text-muted"> · {seasonLabel(v.seasonNumber)}</span>}
                {t.year && <span className="ml-1.5 text-sm text-dim">{t.year}</span>}
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                {v.rating !== null && <span className="font-bold text-gold">{v.rating}/10</span>}
                {v.liked && <Heart className="size-4 fill-accent text-accent" aria-label="Liked" />}
                {v.isRewatch && <Repeat className="size-4 text-muted" aria-label="Rewatch" />}
                <span className="text-dim">{[formatDate(v.watchedOn), v.watchedWhere].filter(Boolean).join(" · ")}</span>
              </p>
              {v.reviewHtml && <ReviewBody html={v.reviewHtml} spoilers={v.containsSpoilers} className="mt-2 text-sm" />}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
