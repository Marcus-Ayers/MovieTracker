"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
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
  compact = false,
}: {
  year: number;
  days: DayMap;
  kind: Kind;
  selected: string | null;
  onSelect: (date: string) => void;
  compact?: boolean;
}) {
  const columns = weekColumns(`${year}-01-01`, `${year}-12-31`);
  const cell = compact ? "size-[9px] sm:size-[10px] xl:size-[13px]" : "size-[11px] sm:size-[13px] xl:size-[18px]";
  const gap = compact ? "gap-[2px]" : "gap-[3px]";

  return (
    <div className="no-scrollbar overflow-x-auto pb-1">
      <div className="inline-flex flex-col">
        {!compact && (
          <div className={cn("ml-8 flex", gap)}>
            {columns.map((week, i) => {
              const first = week.find((d) => d && d.endsWith("-01")) ?? (i === 0 ? week.find(Boolean) : undefined);
              return (
                <span key={i} className={cn("relative text-[11px] text-dim", cell)}>
                  {first && <span className="absolute -top-0.5 left-0 whitespace-nowrap">{MONTHS[Number(first.slice(5, 7)) - 1]}</span>}
                </span>
              );
            })}
          </div>
        )}
        <div className={cn("flex", !compact && "mt-4")}>
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
                      title={`${formatDate(date)}: ${count ? countLabel(kind, count) : "nothing"}`}
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
}: {
  year: number;
  month: number;
  days: DayMap;
  kind: Kind;
  selected: string | null;
  onSelect: (date: string) => void;
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
  const toggle = (date: string) => setSelected((s) => (s === date ? null : date));
  const totalFor = (prefix: string) =>
    Object.entries(days).reduce((sum, [d, list]) => (d.startsWith(prefix) ? sum + list.length : sum), 0);

  return (
    <div>
      {view === "year" && <YearGrid year={year} days={days} kind={kind} selected={selected} onSelect={toggle} />}
      {view === "month" && <MonthGrid year={year} month={month} days={days} kind={kind} selected={selected} onSelect={toggle} />}
      {view === "all" && (
        <div className="space-y-3">
          {years.map((y) => (
            <div key={y} className="flex items-center gap-4">
              <div className="w-20 shrink-0">
                <p className="text-sm font-semibold">{y}</p>
                <p className="text-[11px] text-dim">{countLabel(kind, totalFor(String(y)))}</p>
              </div>
              <YearGrid year={y} days={days} kind={kind} selected={selected} onSelect={toggle} compact />
            </div>
          ))}
        </div>
      )}
      <div className="mt-3 flex justify-end">
        <Legend kind={kind} />
      </div>
      {selected && <DayPanel date={selected} days={days} kind={kind} onClose={() => setSelected(null)} />}
    </div>
  );
}
