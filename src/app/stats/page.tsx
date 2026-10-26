import { ChevronLeft, ChevronRight, Flame, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { NoOwnerNotice, PageHeader, PageSkeleton, PrivateNotice } from "@/components/page";
import { Heatmap } from "@/components/stats/heatmap";
import { getProfileAccess } from "@/lib/auth";
import { cn, plural, titleHref, tmdbImage } from "@/lib/format";
import { getCreditsFor, getViewings, summarize, type ViewingWithTitle } from "@/lib/library";
import { computeStreaks, countBy, MONTHS, MONTHS_LONG, toDateString, type DayMap } from "@/lib/stats";

export const metadata: Metadata = { title: "Stats" };

type View = "all" | "year" | "month";

function href(view: View, year: number, month: number) {
  if (view === "all") return "/stats";
  if (view === "year") return `/stats?view=year&year=${year}`;
  return `/stats?view=month&year=${year}&month=${month}`;
}

function toDayMap(rows: ViewingWithTitle[]): DayMap {
  const map: DayMap = {};
  for (const { viewing: v, title: t } of rows) {
    if (!v.watchedOn) continue;
    (map[v.watchedOn] ??= []).push({
      id: v.id,
      title: t.title,
      href: titleHref(t.mediaType, t.tmdbId),
      posterPath: t.posterPath,
      rating: v.rating,
      seasonNumber: v.seasonNumber,
    });
  }
  return map;
}

function Card({ title, children, className }: { title: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl border border-line bg-surface p-5 sm:p-6", className)}>
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">{title}</h2>
      {children}
    </section>
  );
}

function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4 sm:p-5">
      <p className="text-xs uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-1 text-3xl font-black tabular-nums tracking-tight">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-dim">{sub}</p>}
    </div>
  );
}

/** Horizontal bar list. */
function Bars({ items, color = "bg-accent" }: { items: [string, number][]; color?: string }) {
  const max = Math.max(1, ...items.map(([, n]) => n));
  if (!items.length) return <p className="text-sm text-dim">Nothing yet.</p>;
  return (
    <ul className="space-y-2">
      {items.map(([label, n]) => (
        <li key={label} className="grid grid-cols-[7rem_1fr_2.5rem] items-center gap-3 text-sm">
          <span className="truncate text-muted">{label}</span>
          <span className="h-2.5 overflow-hidden rounded-full bg-surface-3">
            <span className={cn("block h-full rounded-full", color)} style={{ width: `${(n / max) * 100}%` }} />
          </span>
          <span className="text-right tabular-nums">{n}</span>
        </li>
      ))}
    </ul>
  );
}

/** Vertical columns, e.g. movies per month. */
function Columns({ items }: { items: { label: string; value: number; href?: string }[] }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="flex h-44 items-end gap-1.5 sm:gap-2">
      {items.map((item) => {
        const bar = (
          <>
            <span className="text-[11px] tabular-nums text-muted">{item.value || ""}</span>
            <span
              className="w-full rounded-t bg-accent/80 transition group-hover/col:bg-accent"
              style={{ height: `${Math.max(item.value ? 4 : 0, (item.value / max) * 100)}%` }}
            />
            <span className="text-[11px] text-dim">{item.label}</span>
          </>
        );
        return item.href ? (
          <Link key={item.label} href={item.href} className="group/col flex h-full flex-1 flex-col items-center justify-end gap-1">
            {bar}
          </Link>
        ) : (
          <div key={item.label} className="group/col flex h-full flex-1 flex-col items-center justify-end gap-1">
            {bar}
          </div>
        );
      })}
    </div>
  );
}

type PersonStat = { id: number; name: string; profilePath: string | null; count: number; avg: number | null };

function PeopleList({ people, empty }: { people: PersonStat[]; empty: string }) {
  if (!people.length) return <p className="text-sm text-dim">{empty}</p>;
  return (
    <ol className="space-y-2.5">
      {people.map((p, i) => (
        <li key={p.id}>
          <Link href={`/person/${p.id}`} className="group/p flex items-center gap-3">
            <span className="w-4 text-right text-xs tabular-nums text-dim">{i + 1}</span>
            <span className="relative size-10 shrink-0 overflow-hidden rounded-full bg-surface-3">
              {p.profilePath && <Image src={tmdbImage(p.profilePath, "w92")!} alt="" fill sizes="40px" className="object-cover" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium group-hover/p:underline">{p.name}</span>
              <span className="block text-xs text-dim">
                {plural(p.count, "title")}
                {p.avg !== null && <> · avg <span className="text-gold">{p.avg.toFixed(1)}</span></>}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

async function Stats({ searchParams }: { searchParams: PageProps<"/stats">["searchParams"] }) {
  const access = await getProfileAccess();
  if (access.status === "no-owner") return <NoOwnerNotice />;
  if (access.status === "private") return <PrivateNotice name={access.owner.displayName} />;

  const params = await searchParams;
  const today = toDateString(new Date());
  const currentYear = Number(today.slice(0, 4));
  const currentMonth = Number(today.slice(5, 7));
  const view: View = params.view === "year" || params.view === "month" ? params.view : "all";
  const year = Number(params.year) || currentYear;
  const month = Math.min(12, Math.max(1, Number(params.month) || currentMonth));
  const prefix = view === "year" ? `${year}` : view === "month" ? `${year}-${String(month).padStart(2, "0")}` : "";

  const rows = await getViewings(access.owner.id);
  const movies = rows.filter((r) => r.title.mediaType === "movie");
  const tv = rows.filter((r) => r.title.mediaType === "tv");
  const inPeriod = (r: ViewingWithTitle) => (view === "all" ? true : Boolean(r.viewing.watchedOn?.startsWith(prefix)));
  const periodMovies = movies.filter(inPeriod);
  const periodTv = tv.filter(inPeriod);

  const years = [
    ...new Set([currentYear, ...rows.map((r) => Number(r.viewing.watchedOn?.slice(0, 4))).filter(Boolean)]),
  ].sort((a, b) => b - a);

  // Headline numbers
  const uniqueMovies = new Set(periodMovies.map((r) => r.title.id)).size;
  const minutes = periodMovies.reduce((sum, r) => sum + (r.title.runtime ?? 0), 0);
  const rated = periodMovies.filter((r) => r.viewing.rating !== null);
  const avgRating = rated.length ? rated.reduce((s, r) => s + r.viewing.rating!, 0) / rated.length : null;
  const rewatches = periodMovies.filter((r) => r.viewing.isRewatch).length;
  const streaks = computeStreaks(
    movies.map((r) => r.viewing.watchedOn).filter((d): d is string => Boolean(d)),
    today,
  );

  // Per-month (year view) or per-year (all-time) columns
  const columns =
    view === "year"
      ? MONTHS.map((label, i) => ({
          label,
          value: periodMovies.filter((r) => r.viewing.watchedOn?.slice(5, 7) === String(i + 1).padStart(2, "0")).length,
          href: href("month", year, i + 1),
        }))
      : view === "all"
        ? [...years].reverse().map((y) => ({
            label: String(y),
            value: movies.filter((r) => r.viewing.watchedOn?.startsWith(String(y))).length,
            href: href("year", y, 1),
          }))
        : null;

  const ratingDist = Array.from({ length: 10 }, (_, i) => 10 - i).map(
    (n) => [`${n}`, periodMovies.filter((r) => r.viewing.rating === n).length] as [string, number],
  );
  const genres = countBy(
    periodMovies.flatMap((r) => r.title.genres.map((g) => ({ g: g.name }))),
    (x) => x.g,
  ).slice(0, 8) as [string, number][];
  const decades = countBy(periodMovies, (r) => (r.title.year ? `${Math.floor(r.title.year / 10) * 10}s` : null))
    .sort((a, b) => String(b[0]).localeCompare(String(a[0])))
    .slice(0, 8) as [string, number][];
  const where = countBy(periodMovies, (r) => r.viewing.watchedWhere).slice(0, 6) as [string, number][];

  // Directors & actors across the movies in this period, using your overall rating for each title.
  const byTitle = new Map<number, ViewingWithTitle[]>();
  for (const r of movies) byTitle.set(r.title.id, [...(byTitle.get(r.title.id) ?? []), r]);
  const titleRating = new Map(
    [...byTitle.entries()].map(([id, list]) => [id, summarize(list[0].title, list.map((x) => x.viewing), 0).rating]),
  );
  const periodTitleIds = [...new Set(periodMovies.map((r) => r.title.id))];
  const credits = await getCreditsFor(periodTitleIds, ["director", "cast"]);
  const rank = (role: "director" | "cast"): PersonStat[] => {
    const people = new Map<number, { name: string; profilePath: string | null; titles: Set<number> }>();
    for (const c of credits) {
      if (c.role !== role || (role === "cast" && c.order > 7)) continue;
      const p = people.get(c.personId) ?? { name: c.name, profilePath: c.profilePath, titles: new Set<number>() };
      p.titles.add(c.titleId);
      people.set(c.personId, p);
    }
    return [...people.entries()]
      .map(([id, p]) => {
        const ratings = [...p.titles].map((t) => titleRating.get(t)).filter((r): r is number => r != null);
        return {
          id,
          name: p.name,
          profilePath: p.profilePath,
          count: p.titles.size,
          avg: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
        };
      })
      .filter((p) => p.count > 1 || periodTitleIds.length < 15)
      .sort((a, b) => b.count - a.count || (b.avg ?? 0) - (a.avg ?? 0))
      .slice(0, 10);
  };
  const directors = rank("director");
  const actors = rank("cast");

  const prev = view === "month" ? (month === 1 ? [year - 1, 12] : [year, month - 1]) : [year - 1, month];
  const next = view === "month" ? (month === 12 ? [year + 1, 1] : [year, month + 1]) : [year + 1, month];
  const periodLabel = view === "all" ? "All time" : view === "year" ? String(year) : `${MONTHS_LONG[month - 1]} ${year}`;

  return (
    <>
      <PageHeader title={access.isOwner ? "Your stats" : `${access.owner.displayName}'s stats`} subtitle={periodLabel}>
        <div className="flex items-center gap-3">
          <div className="flex rounded-full border border-line p-0.5 text-sm">
            {(["all", "year", "month"] as View[]).map((v) => (
              <Link
                key={v}
                href={href(v, year, month)}
                className={cn("rounded-full px-4 py-1.5 transition", view === v ? "bg-fg font-semibold text-bg" : "text-muted hover:text-fg")}
              >
                {v === "all" ? "All time" : v === "year" ? "Year" : "Month"}
              </Link>
            ))}
          </div>
          {view !== "all" && (
            <div className="flex items-center">
              <Link href={href(view, prev[0], prev[1])} aria-label="Previous" className="grid size-9 place-items-center rounded-full hover:bg-surface-2">
                <ChevronLeft className="size-5" />
              </Link>
              <Link href={href(view, next[0], next[1])} aria-label="Next" className="grid size-9 place-items-center rounded-full hover:bg-surface-2">
                <ChevronRight className="size-5" />
              </Link>
            </div>
          )}
        </div>
      </PageHeader>

      <div className="space-y-6 px-4 sm:px-8 lg:px-12">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Stat label="Movies watched" value={periodMovies.length} sub={`${plural(uniqueMovies, "unique film")}`} />
          <Stat label="Hours" value={Math.round(minutes / 60).toLocaleString()} sub={`${plural(Math.round(minutes / 60 / 24), "day")} of film`} />
          <Stat label="Avg rating" value={avgRating !== null ? avgRating.toFixed(1) : "–"} sub={`${plural(rated.length, "rating")}`} />
          <Stat label="Rewatches" value={rewatches} sub={periodMovies.length ? `${Math.round((rewatches / periodMovies.length) * 100)}% of watches` : undefined} />
          <Stat label="TV seasons" value={periodTv.length} sub={plural(new Set(periodTv.map((r) => r.title.id)).size, "show")} />
          <div className="rounded-xl border border-line bg-surface p-4 sm:p-5">
            <p className="text-xs uppercase tracking-wider text-muted">Streaks</p>
            <p className="mt-2 flex items-center gap-2 text-sm">
              <Flame className="size-4 text-accent" /> <span className="text-2xl font-black tabular-nums">{streaks.current}</span>
              <span className="text-dim">day{streaks.current === 1 ? "" : "s"} now</span>
            </p>
            <p className="mt-1 flex items-center gap-2 text-sm">
              <Trophy className="size-4 text-gold" /> <span className="font-bold tabular-nums">{streaks.longest}</span>
              <span className="text-dim">longest</span>
            </p>
          </div>
        </div>

        <Card title={<>Movies · <span className="normal-case tracking-normal">{periodLabel}</span></>}>
          <Heatmap view={view} year={year} month={month} years={years} days={toDayMap(movies)} kind="movie" />
        </Card>

        <Card title={<>TV seasons · <span className="normal-case tracking-normal">{periodLabel}</span></>}>
          <Heatmap view={view} year={year} month={month} years={years} days={toDayMap(tv)} kind="tv" />
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          {columns && (
            <Card title={view === "year" ? "Movies per month" : "Movies per year"} className="lg:col-span-2">
              <Columns items={columns} />
            </Card>
          )}
          <Card title="Most-watched directors">
            <PeopleList people={directors} empty="Log a few more movies to see your favorite directors." />
          </Card>
          <Card title="Most-watched actors">
            <PeopleList people={actors} empty="Log a few more movies to see who shows up most." />
          </Card>
          <Card title="Your ratings">
            <Bars items={ratingDist.map(([n, c]) => [`${n}/10`, c])} color="bg-gold" />
          </Card>
          <Card title="Genres">
            <Bars items={genres} />
          </Card>
          <Card title="Decades">
            <Bars items={decades} />
          </Card>
          <Card title="Where you watched">
            <Bars items={where} color="bg-tv" />
          </Card>
        </div>
      </div>
    </>
  );
}

export default function StatsPage(props: PageProps<"/stats">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Stats searchParams={props.searchParams} />
    </Suspense>
  );
}
