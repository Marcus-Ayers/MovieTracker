"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type FocusEvent, type PointerEvent } from "react";
import { cn, formatDate, seasonLabel, tmdbImage } from "@/lib/format";
import { heatLevel, monthWeeks, MONTHS, weekColumns, type DayMap } from "@/lib/stats";

type Kind = "movie" | "tv";

const LEVELS: Record<Kind, string[]> = {
  movie: ["bg-heat-0", "bg-heat-1", "bg-heat-2", "bg-heat-3", "bg-heat-4"],
  tv: ["bg-heat-0", "bg-tvheat-1", "bg-tvheat-2", "bg-tvheat-3", "bg-tvheat-4"],
};

const NOUN: Record<Kind, [string, string]> = { movie: ["movie", "movies"], tv: ["season", "seasons"] };

function countLabel(kind: Kind, n: number) {
  return `${n} ${n === 1 ? NOUN[kind][0] : NOUN[kind][1]}`;
}

type HoverHandler = (date: string | null, el?: HTMLElement) => void;

// Phones can't hover: a tap opens the day panel instead, so skip the floating popup there.
const canHover = () => !window.matchMedia("(hover: none)").matches;

/** Hover and keyboard focus both show the day popup. */
function hoverProps(date: string, onHover: HoverHandler) {
  return {
    onPointerEnter: (e: PointerEvent<HTMLElement>) => e.pointerType !== "touch" && canHover() && onHover(date, e.currentTarget),
    onPointerLeave: () => onHover(null),
    onFocus: (e: FocusEvent<HTMLElement>) => canHover() && onHover(date, e.currentTarget),
    onBlur: () => onHover(null),
  };
}

const TOOLTIP_WIDTH = 272;
const TOOLTIP_MAX_ITEMS = 6;

/** Floating popup over a hovered day: what you watched, with posters and your ratings. */
function DayTooltip({ date, rect, days, kind }: { date: string; rect: DOMRect; days: DayMap; kind: Kind }) {
  const entries = days[date] ?? [];
  const left = Math.min(Math.max(rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2, 8), window.innerWidth - TOOLTIP_WIDTH - 8);
  // Show above the square when there's room, otherwise below it.
  const above = rect.top > 90 + Math.min(entries.length, TOOLTIP_MAX_ITEMS) * 44;
  return (
    <div
      role="tooltip"
      className="pointer-events-none fixed z-50 rounded-lg border border-line bg-surface/95 p-3 shadow-2xl shadow-black/70 backdrop-blur"
      style={{
        width: TOOLTIP_WIDTH,
        left,
        top: above ? rect.top - 8 : rect.bottom + 8,
        transform: above ? "translateY(-100%)" : undefined,
      }}
    >
      <p className="text-xs font-semibold">
        {formatDate(date)} <span className="font-normal text-muted">· {entries.length ? countLabel(kind, entries.length) : "nothing logged"}</span>
      </p>
      {entries.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {entries.slice(0, TOOLTIP_MAX_ITEMS).map((e) => (
            <li key={e.id} className="flex items-center gap-2.5">
              <span className="relative h-9 w-6 shrink-0 overflow-hidden rounded-sm bg-surface-3">
                {e.posterPath && <Image src={tmdbImage(e.posterPath, "w92")!} alt="" fill sizes="24px" className="object-cover" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium">{e.title}</span>
                {kind === "tv" && <span className="block text-[11px] text-dim">{seasonLabel(e.seasonNumber)}</span>}
              </span>
              {e.rating !== null && <span className="shrink-0 text-xs font-bold text-gold">{e.rating}/10</span>}
            </li>
          ))}
        </ul>
      )}
      {entries.length > TOOLTIP_MAX_ITEMS && <p className="mt-1.5 text-[11px] text-dim">+{entries.length - TOOLTIP_MAX_ITEMS} more</p>}
      {entries.length > 0 && <p className="mt-2 text-[10px] text-dim">Click for details</p>}
    </div>
  );
}

function Legend({ kind }: { kind: Kind }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-dim">
      Less
      {LEVELS[kind].map((c) => (
        <span key={c} className={cn("size-[11px] rounded-[3px]", c)} />
      ))}
      More
    </div>
  );
}

function YearGrid({
  year,
  days,
  kind,
  selected,
  onSelect,
  onHover,
  compact = false,
}: {
  year: number;
  days: DayMap;
  kind: Kind;
  selected: string | null;
  onSelect: (date: string) => void;
  onHover: HoverHandler;
  compact?: boolean;
}) {
  const columns = weekColumns(`${year}-01-01`, `${year}-12-31`);
  const cell = compact ? "size-[9px] sm:size-[10px] xl:size-[13px]" : "size-[11px] sm:size-[13px] xl:size-[18px]";
  const cellWidth = compact ? "w-[9px] sm:w-[10px] xl:w-[13px]" : "w-[11px] sm:w-[13px] xl:w-[18px]";
  const gap = compact ? "gap-[2px]" : "gap-[3px]";

  return (
    <div className="no-scrollbar overflow-x-auto overflow-y-hidden pb-1">
      <div className="inline-flex flex-col">
        {/* Month names over the week where each month starts. */}
        <div className={cn("flex", gap, !compact && "ml-8")} aria-hidden>
          {columns.map((week, i) => {
            const first = week.find((d) => d && d.endsWith("-01")) ?? (i === 0 ? week.find(Boolean) : undefined);
            return (
              <span key={i} className={cn("relative", cellWidth, compact ? "h-3" : "h-4")}>
                {first && (
                  <span
                    className={cn(
                      "absolute left-0 top-0 whitespace-nowrap font-medium leading-none",
                      compact ? "text-[9px] text-dim xl:text-[10px]" : "text-xs text-muted",
                    )}
                  >
                    {MONTHS[Number(first.slice(5, 7)) - 1]}
                  </span>
                )}
              </span>
            );
          })}
        </div>
        <div className={cn("flex", compact ? "mt-0.5" : "mt-1")}>
          {!compact && (
            <div className={cn("mr-2 grid w-6 text-[10px] leading-none text-dim", gap)} style={{ gridTemplateRows: "repeat(7, 1fr)" }}>
              {["", "Mon", "", "Wed", "", "Fri", ""].map((d, i) => (
                <span key={i} className="flex items-center">
                  {d}
                </span>
              ))}
            </div>
          )}
          <div className={cn("flex", gap)}>
            {columns.map((week, i) => (
              <div key={i} className={cn("flex flex-col", gap)}>
                {week.map((date, j) => {
                  if (!date) return <span key={j} className={cell} />;
                  const count = days[date]?.length ?? 0;
                  return (
                    <button
                      key={date}
                      type="button"
                      onClick={() => onSelect(date)}
                      aria-label={`${formatDate(date)}: ${count ? countLabel(kind, count) : "nothing logged"}`}
                      {...hoverProps(date, onHover)}
                      className={cn(
                        "rounded-[3px] transition hover:ring-1 hover:ring-fg/70",
                        cell,
                        LEVELS[kind][heatLevel(count)],
                        selected === date && "ring-2 ring-fg",
                      )}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MonthGrid({
  year,
  month,
  days,
  kind,
  selected,
  onSelect,
  onHover,
}: {
  year: number;
  month: number;
  days: DayMap;
  kind: Kind;
  selected: string | null;
  onSelect: (date: string) => void;
  onHover: HoverHandler;
}) {
  const columns = monthWeeks(year, month);
  // Each week is Sun→Sat, so flattening the weeks fills a 7-column grid row by row.
  return (
    <div className="max-w-3xl">
      <div className="mb-2 grid grid-cols-7 gap-1.5 text-center text-[11px] uppercase tracking-wider text-dim">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {columns.flat().map((date, i) => {
          if (!date) return <span key={i} />;
          const entries = days[date] ?? [];
          const poster = entries.find((e) => e.posterPath)?.posterPath;
          return (
            <button
              key={date}
              type="button"
              onClick={() => onSelect(date)}
              aria-label={`${formatDate(date)}: ${entries.length ? countLabel(kind, entries.length) : "nothing logged"}`}
              {...hoverProps(date, onHover)}
              className={cn(
                "group/day relative aspect-[2/3] overflow-hidden rounded-md text-left transition sm:aspect-square",
                entries.length ? LEVELS[kind][heatLevel(entries.length)] : "bg-surface-2/60",
                selected === date ? "ring-2 ring-fg" : "hover:ring-1 hover:ring-fg/50",
              )}
            >
              {poster && (
                <Image src={tmdbImage(poster, "w185")!} alt="" fill sizes="120px" className="object-cover opacity-80 transition group-hover/day:opacity-100" />
              )}
              <span className="absolute left-1.5 top-1 text-xs font-semibold drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">{Number(date.slice(8))}</span>
              {entries.length > 1 && (
                <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 text-[10px] font-bold">{entries.length}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DayPanel({ date, days, kind, onClose }: { date: string; days: DayMap; kind: Kind; onClose: () => void }) {
  const entries = days[date] ?? [];
  return (
    <div className="mt-5 rounded-lg border border-line bg-bg/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold">
          {formatDate(date)} · <span className="text-muted">{entries.length ? countLabel(kind, entries.length) : "Nothing logged"}</span>
        </p>
        <button type="button" onClick={onClose} className="text-xs text-dim hover:text-fg">
          Close
        </button>
      </div>
      {entries.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {entries.map((e) => (
            <Link key={e.id} href={e.href} className="group/entry w-24">
              <div className="relative aspect-[2/3] overflow-hidden rounded bg-surface-2">
                {e.posterPath && <Image src={tmdbImage(e.posterPath, "w185")!} alt="" fill sizes="96px" className="object-cover" />}
                {e.rating !== null && (
                  <span className="absolute left-1 top-1 rounded bg-gold px-1 text-[11px] font-bold text-black">{e.rating}</span>
                )}
              </div>
              <p className="mt-1 line-clamp-2 text-xs group-hover/entry:underline">{e.title}</p>
              {kind === "tv" && <p className="text-[11px] text-dim">{seasonLabel(e.seasonNumber)}</p>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * A GitHub-style grid of days, darker the more you watched: a whole year, every year (all time), or one month.
 * Hover a day for a popup; click or tap for the full list.
 */
export function Heatmap({
  view,
  year,
  month,
  years,
  days,
  kind,
}: {
  view: "all" | "year" | "month";
  year: number;
  month: number;
  years: number[];
  days: DayMap;
  kind: Kind;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [hover, setHover] = useState<{ date: string; rect: DOMRect } | null>(null);
  const toggle = (date: string) => setSelected((s) => (s === date ? null : date));
  const onHover: HoverHandler = (date, el) => setHover(date && el ? { date, rect: el.getBoundingClientRect() } : null);

  // The popup is pinned to the screen, so hide it as soon as anything scrolls.
  useEffect(() => {
    if (!hover) return;
    const hide = () => setHover(null);
    window.addEventListener("scroll", hide, { capture: true, passive: true });
    return () => window.removeEventListener("scroll", hide, { capture: true });
  }, [hover]);
  const totalFor = (prefix: string) =>
    Object.entries(days).reduce((sum, [d, list]) => (d.startsWith(prefix) ? sum + list.length : sum), 0);

  return (
    <div>
      {view === "year" && <YearGrid year={year} days={days} kind={kind} selected={selected} onSelect={toggle} onHover={onHover} />}
      {view === "month" && (
        <MonthGrid year={year} month={month} days={days} kind={kind} selected={selected} onSelect={toggle} onHover={onHover} />
      )}
      {view === "all" && (
        <div className="space-y-3">
          {years.map((y) => (
            <div key={y} className="flex items-center gap-4">
              <div className="w-20 shrink-0">
                <p className="text-sm font-semibold">{y}</p>
                <p className="text-[11px] text-dim">{countLabel(kind, totalFor(String(y)))}</p>
              </div>
              <YearGrid year={y} days={days} kind={kind} selected={selected} onSelect={toggle} onHover={onHover} compact />
            </div>
          ))}
        </div>
      )}
      <div className="mt-3 flex justify-end">
        <Legend kind={kind} />
      </div>
      {selected && <DayPanel date={selected} days={days} kind={kind} onClose={() => setSelected(null)} />}
      {hover && <DayTooltip date={hover.date} rect={hover.rect} days={days} kind={kind} />}
    </div>
  );
}
