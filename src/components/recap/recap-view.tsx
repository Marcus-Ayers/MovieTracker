import { CalendarDays, Clapperboard, Flame, Flower2, Hourglass, MapPin, Repeat, Sparkles, ThumbsDown, ThumbsUp, Tv } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/page";
import { ProfileTabs } from "@/components/profile/profile-nav";
import type { Title } from "@/db";
import type { CurrentUser } from "@/lib/auth";
import { cn, formatDate, plural, titleHref, tmdbImage } from "@/lib/format";
import { buildRecap, getRecapYears, type RecapPerson, type RecapYear } from "@/lib/recap";
import { MONTHS, MONTHS_LONG } from "@/lib/stats";
import { Top10Row } from "../media/rows";
import { ShareButton } from "./share-button";

const WEEKDAYS = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];
const pad = "px-4 sm:px-8 lg:px-12";

type Props = { profile: CurrentUser; isOwn: boolean; base: string };

function Poster({ title, className }: { title: Title; className?: string }) {
  const src = tmdbImage(title.posterPath, "w185");
  return (
    <Link
      href={titleHref(title.mediaType, title.tmdbId)}
      title={title.title}
      className={cn("relative block aspect-[2/3] shrink-0 overflow-hidden rounded-md bg-surface-3 shadow-lg shadow-black/50", className)}
    >
      {src && <Image src={src} alt={title.title} fill sizes="96px" className="object-cover" />}
    </Link>
  );
}

function YearPills({ years, current, base }: { years: RecapYear[]; current: number; base: string }) {
  return (
    <nav className="no-scrollbar mb-8 flex gap-2 overflow-x-auto overflow-y-hidden">
      {years.map((y) => (
        <Link
          key={y.year}
          href={`${base}/recap/${y.year}`}
          className={cn(
            "shrink-0 rounded-full border px-3.5 py-1.5 text-sm transition",
            y.year === current ? "border-fg bg-fg font-semibold text-bg" : "border-line bg-bg/60 text-muted backdrop-blur hover:text-fg",
          )}
        >
          {y.year}
        </Link>
      ))}
    </nav>
  );
}

function BigStat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/40 p-4 backdrop-blur sm:p-5">
      <p className="text-xs uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-1 text-4xl font-black tabular-nums tracking-tight sm:text-5xl">{value}</p>
      {sub && <p className="mt-1 text-xs text-dim">{sub}</p>}
    </div>
  );
}

function Card({ title, icon, children, className }: { title: string; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border border-line bg-surface p-5 sm:p-6", className)}>
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

function Fact({ icon, label, value, detail, title }: { icon: ReactNode; label: string; value: ReactNode; detail?: ReactNode; title?: Title }) {
  return (
    <div className="flex gap-4 rounded-2xl border border-line bg-surface p-4">
      {title && <Poster title={title} className="w-14" />}
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted">
          {icon}
          {label}
        </p>
        <p className="mt-1 text-lg font-bold leading-snug">{value}</p>
        {detail && <p className="mt-0.5 text-sm text-dim">{detail}</p>}
      </div>
    </div>
  );
}

function PersonCard({ label, person, unit }: { label: string; person: RecapPerson; unit: string }) {
  const photo = tmdbImage(person.profilePath, "h632");
  return (
    <Card title={label}>
      <div className="flex gap-4 sm:gap-5">
        <Link href={`/person/${person.id}`} className="relative aspect-[2/3] w-20 shrink-0 overflow-hidden rounded-xl bg-surface-3 sm:w-28">
          {photo && <Image src={photo} alt={person.name} fill sizes="112px" className="object-cover" />}
        </Link>
        <div className="min-w-0">
          <Link href={`/person/${person.id}`} className="text-2xl font-black leading-tight hover:underline">
            {person.name}
          </Link>
          <p className="mt-1 text-sm text-muted">
            {plural(person.count, unit)}
            {person.avg !== null && (
              <>
                {" · avg "}
                <span className="font-semibold text-gold">{person.avg.toFixed(1)}</span>
              </>
            )}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {person.titles.slice(0, 5).map((t) => (
              <Poster key={t.id} title={t} className="w-11" />
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

function Bars({ items }: { items: [string, number][] }) {
  const max = Math.max(1, ...items.map(([, n]) => n));
  return (
    <ul className="space-y-1.5">
      {items.map(([label, n]) => (
        <li key={label} className="grid grid-cols-[6.5rem_1fr_2rem] items-center gap-3 text-sm">
          <span className="truncate text-muted">{label}</span>
          <span className="h-2.5 overflow-hidden rounded-full bg-surface-3">
            <span className="block h-full rounded-full bg-accent" style={{ width: `${(n / max) * 100}%` }} />
          </span>
          <span className="text-right tabular-nums">{n}</span>
        </li>
      ))}
    </ul>
  );
}

/** Every year that has something in it, as cards (the /recap page). */
export async function RecapYears({ profile, isOwn, base }: Props) {
  const years = await getRecapYears(profile.id);
  return (
    <div className={cn(pad, "pb-12 pt-28")}>
      <p className="text-sm font-semibold uppercase tracking-[0.3em] text-accent">Year in review</p>
      <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">{isOwn ? "Your years in film" : `${profile.displayName}'s years in film`}</h1>
      {base && (
        <div className="-mx-4 mt-4 sm:-mx-8 lg:-mx-12">
          <ProfileTabs profile={profile} base={base} active="recap" />
        </div>
      )}
      {years.length ? (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {years.map((y) => (
            <Link key={y.year} href={`${base}/recap/${y.year}`} className="group relative overflow-hidden rounded-2xl border border-line bg-surface p-5 transition hover:border-fg/30">
              <div className="pointer-events-none absolute -right-6 top-3 flex rotate-6 gap-1 opacity-40 transition group-hover:opacity-70">
                {y.posters.slice(0, 3).map((p, i) =>
                  p ? (
                    <span key={i} className="relative block aspect-[2/3] w-14 overflow-hidden rounded">
                      <Image src={tmdbImage(p, "w185")!} alt="" fill sizes="56px" className="object-cover" />
                    </span>
                  ) : null,
                )}
              </div>
              <p className="relative text-5xl font-black tracking-tighter">{y.year}</p>
              <p className="relative mt-6 text-sm text-muted">
                {plural(y.films, "film")}
                {y.seasons > 0 && ` · ${plural(y.seasons, "season")}`}
              </p>
              <p className="relative text-xs text-dim">{plural(y.hours, "hour")} watched</p>
            </Link>
          ))}
        </div>
      ) : (
        <div className="-mx-4 mt-8 sm:-mx-8 lg:-mx-12">
          <EmptyState title="Nothing to look back on yet">Log what you watch (with dates) and each year gets its own recap.</EmptyState>
        </div>
      )}
    </div>
  );
}

/** One year in review. */
export async function RecapView({ profile, isOwn, base, year }: Props & { year: number }) {
  const [recap, years] = await Promise.all([buildRecap(profile.id, year), getRecapYears(profile.id)]);
  const whose = isOwn ? "Your" : `${profile.displayName}'s`;
  const sharePath = `/u/${profile.username}/recap/${year}`;
  const shareNote = isOwn
    ? profile.visibility === "private"
      ? "Your profile is set to Only me, so nobody else can open this link. Change it in Settings to share."
      : profile.visibility === "friends"
        ? "Only your friends can open this link."
        : undefined
    : undefined;

  if (!recap) {
    return (
      <div className={cn(pad, "pb-12 pt-28")}>
        <YearPills years={years} current={year} base={base} />
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
          {whose} {year} in film
        </h1>
        <div className="-mx-4 mt-8 sm:-mx-8 lg:-mx-12">
          <EmptyState title={`Nothing logged in ${year}`}>Pick another year above.</EmptyState>
        </div>
      </div>
    );
  }

  const backdrop = recap.topFilms.find((f) => f.title.backdropPath)?.title.backdropPath;
  const ratings = Object.fromEntries(recap.topFilms.map((f) => [`movie-${f.title.tmdbId}`, f.rating]));
  const diff = recap.previous ? recap.films - recap.previous.films : null;
  const peakWeekday = recap.weekdays.indexOf(Math.max(...recap.weekdays));
  const statsHref = `${base}/stats?view=year&year=${year}`;

  return (
    <>
      <section className="relative overflow-hidden">
        {backdrop && <Image src={tmdbImage(backdrop, "w1280")!} alt="" fill preload sizes="100vw" className="object-cover opacity-35" />}
        <div className="absolute inset-0 bg-gradient-to-b from-bg/30 via-bg/75 to-bg" />
        <div className={cn("relative pb-12 pt-28", pad)}>
          <YearPills years={years} current={year} base={base} />
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-accent">{whose} year in film</p>
          <h1 className="text-[28vw] font-black leading-[0.85] tracking-tighter sm:text-[11rem]">{year}</h1>
          <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <BigStat label="Films" value={recap.films} sub={recap.watches > recap.films ? `${plural(recap.watches, "watch", "watches")} in all` : undefined} />
            <BigStat label="Hours" value={recap.hours.toLocaleString()} sub={recap.tv.hours ? `+ ${plural(recap.tv.hours, "hour")} of TV` : `${plural(Math.round(recap.hours / 24), "day")} of film`} />
            <BigStat label="Avg rating" value={recap.avgRating !== null ? recap.avgRating.toFixed(1) : "–"} sub={plural(recap.rated, "rating")} />
            <BigStat label="New to you" value={recap.newToYou} sub={recap.rewatches ? plural(recap.rewatches, "rewatch", "rewatches") : "first watches"} />
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            <p className="text-muted">
              {diff !== null && recap.previous && (
                <>
                  {diff === 0
                    ? "The same number of films as"
                    : `${Math.abs(diff).toLocaleString()} ${diff > 0 ? "more" : "fewer"} ${Math.abs(diff) === 1 ? "film" : "films"} than`}{" "}
                  <Link href={`${base}/recap/${recap.previous.year}`} className="text-fg underline decoration-accent underline-offset-4">
                    {recap.previous.year}
                  </Link>
                  .
                </>
              )}
            </p>
            <ShareButton path={sharePath} title={`${profile.displayName}'s ${year} in film`} note={shareNote} />
          </div>
        </div>
      </section>

      {base && <ProfileTabs profile={profile} base={base} active="recap" />}

      <div className="space-y-10 pb-14">
        {recap.topFilms.length > 0 && (
          <Top10Row
            title={`${whose} top ${recap.topFilms.length === 10 ? "10" : recap.topFilms.length} of ${year}`}
            items={recap.topFilms.map((f) => ({ id: f.title.tmdbId, mediaType: "movie", title: f.title.title, year: f.title.year, posterPath: f.title.posterPath }))}
            watched={ratings}
          />
        )}

        <div className={cn("grid gap-5 lg:grid-cols-2", pad)}>
          {recap.director && <PersonCard label="Favorite director" person={recap.director} unit="film" />}
          {recap.actor && <PersonCard label="Most-watched actor" person={recap.actor} unit="film" />}
        </div>

        {recap.busiestMonth && (
          <div className={pad}>
            <Card title="Busiest month" icon={<CalendarDays className="size-4" />}>
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                <div>
                  <p className="text-4xl font-black tracking-tight sm:text-5xl">{MONTHS_LONG[recap.busiestMonth.month]}</p>
                  <p className="mt-1 text-muted">{plural(recap.busiestMonth.count, "film")} that month</p>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {recap.busiestMonth.titles.slice(0, 10).map((t) => (
                      <Poster key={t.id} title={t} className="w-12" />
                    ))}
                  </div>
                </div>
                <div className="flex h-44 items-end gap-1.5">
                  {recap.months.map((n, m) => (
                    <div key={m} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                      <span className="text-[11px] tabular-nums text-muted">{n || ""}</span>
                      <span
                        className={cn("w-full rounded-t", m === recap.busiestMonth!.month ? "bg-accent" : "bg-surface-3")}
                        style={{ height: `${Math.max(n ? 4 : 0, (n / Math.max(1, recap.busiestMonth!.count)) * 100)}%` }}
                      />
                      <span className="text-[11px] text-dim">{MONTHS[m]}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        )}

        <div className={cn("grid gap-4 sm:grid-cols-2 xl:grid-cols-3", pad)}>
          {recap.first && <Fact icon={<Flower2 className="size-3.5" />} label="First film of the year" value={recap.first.title.title} detail={formatDate(recap.first.date)} title={recap.first.title} />}
          {recap.last && <Fact icon={<Clapperboard className="size-3.5" />} label={year < new Date().getFullYear() ? "Last film of the year" : "Most recent film"} value={recap.last.title.title} detail={formatDate(recap.last.date)} title={recap.last.title} />}
          {recap.busiestDay && (
            <Fact
              icon={<Sparkles className="size-3.5" />}
              label="Biggest movie day"
              value={`${plural(recap.busiestDay.count, "film")} on ${formatDate(recap.busiestDay.date)}`}
              detail={recap.busiestDay.titles.map((t) => t.title).join(", ")}
              title={recap.busiestDay.titles[0]}
            />
          )}
          {recap.longestStreak > 1 && <Fact icon={<Flame className="size-3.5" />} label="Longest streak" value={`${recap.longestStreak} days in a row`} detail="Something every day" />}
          {recap.watches > 2 && (
            <Fact
              icon={<CalendarDays className="size-3.5" />}
              label="Favorite movie night"
              value={WEEKDAYS[peakWeekday]}
              detail={`${plural(recap.weekdays[peakWeekday], "film")} on a ${WEEKDAYS[peakWeekday].slice(0, -1)}`}
            />
          )}
          {recap.mostRewatched && (
            <Fact icon={<Repeat className="size-3.5" />} label="Most rewatched" value={recap.mostRewatched.title.title} detail={`${recap.mostRewatched.count}× this year`} title={recap.mostRewatched.title} />
          )}
          {recap.lovedMore && (
            <Fact
              icon={<ThumbsUp className="size-3.5" />}
              label="Loved it more than most"
              value={recap.lovedMore.title.title}
              detail={`You ${recap.lovedMore.rating}/10 · everyone ${recap.lovedMore.crowd.toFixed(1)}`}
              title={recap.lovedMore.title}
            />
          )}
          {recap.hotTake && (
            <Fact
              icon={<ThumbsDown className="size-3.5" />}
              label="Hot take"
              value={recap.hotTake.title.title}
              detail={`You ${recap.hotTake.rating}/10 · everyone ${recap.hotTake.crowd.toFixed(1)}`}
              title={recap.hotTake.title}
            />
          )}
          {recap.oldest && <Fact icon={<Hourglass className="size-3.5" />} label="Oldest film" value={recap.oldest.title} detail={String(recap.oldest.year)} title={recap.oldest} />}
          {recap.places[0] && (
            <Fact
              icon={<MapPin className="size-3.5" />}
              label="Where you watched most"
              value={recap.places[0][0]}
              detail={recap.places.map(([p, n]) => `${p} ${n}`).join(" · ")}
            />
          )}
        </div>

        {(recap.genres.length > 0 || recap.decades.length > 0) && (
          <div className={cn("grid gap-5 lg:grid-cols-2", pad)}>
            {recap.genres.length > 0 && (
              <Card title="Top genres">
                <Bars items={recap.genres} />
              </Card>
            )}
            {recap.decades.length > 0 && (
              <Card title="Decades">
                <Bars items={recap.decades.map(([d, n]) => [`${d}s`, n])} />
              </Card>
            )}
          </div>
        )}

        {recap.tv.seasons > 0 && (
          <div className={pad}>
            <Card title="TV" icon={<Tv className="size-4" />}>
              <p className="text-lg">
                <span className="font-black">{plural(recap.tv.seasons, "season")}</span> of {plural(recap.tv.shows, "show")}
                {recap.tv.hours > 0 && <span className="text-muted"> · about {plural(recap.tv.hours, "hour")}</span>}
              </p>
              <div className="mt-4 flex flex-wrap gap-4">
                {recap.tv.top.map((s) => (
                  <div key={s.title.id} className="w-20">
                    <Poster title={s.title} className="w-20" />
                    <p className="mt-1 truncate text-xs text-muted">{s.title.title}</p>
                    <p className="text-xs text-dim">
                      {s.rating !== null && <span className="font-semibold text-gold">{s.rating}/10 · </span>}
                      {plural(s.seasons, "season")}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        <p className={cn("text-sm text-dim", pad)}>
          Built from dated diary entries.{" "}
          <Link href={statsHref} className="text-muted underline hover:text-fg">
            See every stat for {year}
          </Link>
        </p>
      </div>
    </>
  );
}
