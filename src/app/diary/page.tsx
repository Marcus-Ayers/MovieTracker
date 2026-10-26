import { FileText, Heart, Repeat } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState, NoOwnerNotice, PageHeader, PageSkeleton, PrivateNotice } from "@/components/page";
import { getProfileAccess } from "@/lib/auth";
import { cn, plural, seasonLabel, titleHref, tmdbImage } from "@/lib/format";
import { compareViewings, getViewings, type ViewingWithTitle } from "@/lib/library";
import { MONTHS_LONG } from "@/lib/stats";

export const metadata: Metadata = { title: "Diary" };

function Entry({ row }: { row: ViewingWithTitle }) {
  const { viewing: v, title: t } = row;
  const poster = tmdbImage(t.posterPath, "w92");
  return (
    <li className="flex items-center gap-4 border-b border-line/60 py-3 last:border-0">
      <div className="w-10 shrink-0 text-center">
        {v.watchedOn ? <span className="text-2xl font-bold tabular-nums text-fg/90">{Number(v.watchedOn.slice(8))}</span> : <span className="text-xs text-dim">—</span>}
      </div>
      <Link href={titleHref(t.mediaType, t.tmdbId)} className="relative h-[60px] w-10 shrink-0 overflow-hidden rounded bg-surface-2">
        {poster && <Image src={poster} alt="" fill sizes="40px" className="object-cover" />}
      </Link>
      <div className="min-w-0 flex-1">
        <Link href={titleHref(t.mediaType, t.tmdbId)} className="font-semibold hover:underline hover:decoration-accent hover:underline-offset-4">
          {t.title}
        </Link>
        <span className="ml-2 text-sm text-muted">{t.year}</span>
        <p className="truncate text-xs text-dim">
          {[t.mediaType === "tv" ? seasonLabel(v.seasonNumber) : null, v.watchedWhere, v.format, v.watchedWith && `with ${v.watchedWith}`]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {v.reviewHtml && <FileText className="size-4 text-muted" aria-label="Has review" />}
        {v.isRewatch && <Repeat className="size-4 text-muted" aria-label="Rewatch" />}
        {v.liked && <Heart className="size-4 fill-accent text-accent" aria-label="Liked" />}
        <span className={cn("w-12 text-right font-bold tabular-nums", v.rating !== null ? "text-gold" : "text-dim")}>
          {v.rating !== null ? `${v.rating}/10` : "–"}
        </span>
      </div>
    </li>
  );
}

async function Diary({ searchParams }: { searchParams: PageProps<"/diary">["searchParams"] }) {
  const access = await getProfileAccess();
  if (access.status === "no-owner") return <NoOwnerNotice />;
  if (access.status === "private") return <PrivateNotice name={access.owner.displayName} />;

  const params = await searchParams;
  const all = (await getViewings(access.owner.id)).sort((a, b) => compareViewings(b.viewing, a.viewing));
  const years = [...new Set(all.map((r) => r.viewing.watchedOn?.slice(0, 4)).filter((y): y is string => Boolean(y)))];
  const year = typeof params.year === "string" && years.includes(params.year) ? params.year : null;
  const rows = year ? all.filter((r) => r.viewing.watchedOn?.startsWith(year)) : all;

  // Group by month; undated entries go last.
  const groups = new Map<string, ViewingWithTitle[]>();
  for (const row of rows) {
    const key = row.viewing.watchedOn?.slice(0, 7) ?? "unknown";
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  return (
    <>
      <PageHeader title={access.isOwner ? "Your diary" : `${access.owner.displayName}'s diary`} subtitle={plural(rows.length, "entry", "entries")} />
      {years.length > 1 && (
        <div className="no-scrollbar mb-8 flex gap-2 overflow-x-auto px-4 sm:px-8 lg:px-12">
          {[null, ...years].map((y) => (
            <Link
              key={y ?? "all"}
              href={y ? `/diary?year=${y}` : "/diary"}
              className={cn(
                "shrink-0 rounded-full border px-3.5 py-1.5 text-sm transition",
                y === year ? "border-fg bg-fg text-bg" : "border-line text-muted hover:text-fg",
              )}
            >
              {y ?? "All time"}
            </Link>
          ))}
        </div>
      )}
      {rows.length === 0 ? (
        <EmptyState title="Your diary is empty">Every time you log a movie or a season, it shows up here.</EmptyState>
      ) : (
        <div className="max-w-4xl space-y-10 px-4 sm:px-8 lg:px-12">
          {[...groups.entries()].map(([month, entries]) => (
            <section key={month}>
              <h2 className="sticky top-16 z-10 -mx-2 mb-1 bg-bg/95 px-2 py-2 text-sm font-semibold uppercase tracking-widest text-accent backdrop-blur">
                {month === "unknown" ? "Date unknown" : `${MONTHS_LONG[Number(month.slice(5)) - 1]} ${month.slice(0, 4)}`}
                <span className="ml-2 text-dim">{entries.length}</span>
              </h2>
              <ul>
                {entries.map((row) => (
                  <Entry key={row.viewing.id} row={row} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}

export default function DiaryPage(props: PageProps<"/diary">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Diary searchParams={props.searchParams} />
    </Suspense>
  );
}
