import { ChevronRight, FileText, Heart, Repeat, X } from "lucide-react";
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

const monthLabel = (month: string) => `${MONTHS_LONG[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;

async function Diary({ searchParams }: { searchParams: PageProps<"/diary">["searchParams"] }) {
  const access = await getProfileAccess();
  if (access.status === "no-owner") return <NoOwnerNotice />;
  if (access.status === "private") return <PrivateNotice name={access.owner.displayName} />;

  const raw = await searchParams;
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) if (typeof value === "string" && value) params[key] = value;

  const all = (await getViewings(access.owner.id)).sort((a, b) => compareViewings(b.viewing, a.viewing));
  const years = [...new Set(all.map((r) => r.viewing.watchedOn?.slice(0, 4)).filter((y): y is string => Boolean(y)))];

  // Filters (the stats page links here with these).
  const month = /^\d{4}-\d{2}$/.test(params.month ?? "") ? params.month : null;
  const year = month ? month.slice(0, 4) : years.includes(params.year ?? "") ? params.year : null;
  const type = params.type === "movie" || params.type === "tv" ? params.type : null;
  const where = params.where ?? null;
  const rewatch = params.rewatch === "1";
  const rows = all.filter(
    ({ viewing: v, title: t }) =>
      (!month || v.watchedOn?.startsWith(month)) &&
      (!year || v.watchedOn?.startsWith(year)) &&
      (!type || t.mediaType === type) &&
      (!where || v.watchedWhere?.toLowerCase() === where.toLowerCase()) &&
      (!rewatch || v.isRewatch),
  );

  const dated = rows.filter((r) => r.viewing.watchedOn);
  const undated = rows.filter((r) => !r.viewing.watchedOn);
  const groups = new Map<string, ViewingWithTitle[]>();
  for (const row of dated) {
    const key = row.viewing.watchedOn!.slice(0, 7);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  const without = (...keys: string[]) => {
    const next = new URLSearchParams(params);
    keys.forEach((k) => next.delete(k));
    const q = next.toString();
    return q ? `/diary?${q}` : "/diary";
  };
  const activeFilters: { label: string; href: string }[] = [
    month && { label: monthLabel(month), href: without("month") },
    type && { label: type === "movie" ? "Movies" : "TV", href: without("type") },
    where && { label: `Watched on ${where}`, href: without("where") },
    rewatch && { label: "Rewatches", href: without("rewatch") },
  ].filter((f): f is { label: string; href: string } => Boolean(f));

  return (
    <>
      <PageHeader
        title={access.isOwner ? "Your diary" : `${access.owner.displayName}'s diary`}
        subtitle={`${plural(dated.length, "entry", "entries")}${undated.length ? ` · ${undated.length} with no date` : ""}`}
      />
      {years.length > 0 && (
        <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto px-4 sm:px-8 lg:px-12">
          {[null, ...years].map((y) => (
            <Link
              key={y ?? "all"}
              href={(() => {
                const next = new URLSearchParams(params);
                next.delete("month");
                if (y) next.set("year", y);
                else next.delete("year");
                const q = next.toString();
                return q ? `/diary?${q}` : "/diary";
              })()}
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
      {activeFilters.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2 px-4 sm:px-8 lg:px-12">
          {activeFilters.map((f) => (
            <Link key={f.label} href={f.href} className="inline-flex items-center gap-1.5 rounded-full bg-surface-3 px-3 py-1 text-sm hover:bg-surface-2">
              {f.label} <X className="size-3.5 text-muted" />
            </Link>
          ))}
        </div>
      )}
      {rows.length === 0 ? (
        <EmptyState title={all.length ? "No entries match" : "Your diary is empty"}>
          {all.length ? "Try removing a filter." : "Every time you log a movie or a season, it shows up here."}
        </EmptyState>
      ) : (
        <div className="max-w-4xl space-y-10 px-4 sm:px-8 lg:px-12">
          {[...groups.entries()].map(([key, entries]) => (
            <section key={key}>
              <h2 className="sticky top-16 z-10 -mx-2 mb-1 bg-bg/95 px-2 py-2 text-sm font-semibold uppercase tracking-widest text-accent backdrop-blur">
                {monthLabel(key)}
                <span className="ml-2 text-dim">{entries.length}</span>
              </h2>
              <ul>
                {entries.map((row) => (
                  <Entry key={row.viewing.id} row={row} />
                ))}
              </ul>
            </section>
          ))}
          {undated.length > 0 && (
            <details className="group rounded-xl border border-line">
              <summary className="flex cursor-pointer select-none items-center gap-2 px-4 py-3 text-sm text-muted hover:text-fg">
                <ChevronRight className="size-4 transition group-open:rotate-90" />
                <span className="font-semibold uppercase tracking-widest">Date unknown</span>
                <span className="text-dim">{undated.length}</span>
                <span className="ml-auto text-xs text-dim">Imported ratings and things you didn&apos;t date</span>
              </summary>
              <ul className="border-t border-line px-4">
                {undated.map((row) => (
                  <Entry key={row.viewing.id} row={row} />
                ))}
              </ul>
            </details>
          )}
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
