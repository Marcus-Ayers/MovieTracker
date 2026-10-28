"use client";

import { SlidersHorizontal } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { cn } from "@/lib/format";
import { Modal } from "./ui/modal";

export type FilterControl = {
  name: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
};

type Params = Record<string, string>;

/** Writes one query param (keeping the rest) and navigates without scrolling. */
function useQueryUpdater(params: Params) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const update = (name: string, value: string | null, alsoRemove: string[] = []) => {
    const next = new URLSearchParams(params);
    if (value) next.set(name, value);
    else next.delete(name);
    for (const key of alsoRemove) next.delete(key);
    const query = next.toString();
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  };
  return { update, pending };
}

/**
 * A row of dropdowns that write their values into the URL. Current values come from the server. On phones the
 * row turns into one "Filters & sort" button that opens them in a sheet.
 */
export function FilterBar({ controls, params, className }: { controls: FilterControl[]; params: Params; className?: string }) {
  const { update, pending } = useQueryUpdater(params);
  const [open, setOpen] = useState(false);
  const active = controls.filter((c) => c.value !== (c.options[0]?.value ?? "")).length;
  const onChange = (c: FilterControl, value: string) => update(c.name, value === c.options[0]?.value ? null : value);

  return (
    <>
      <div className={cn("hidden flex-wrap gap-2 transition-opacity sm:flex", pending && "opacity-60", className)}>
        {controls.map((c) => (
          <label key={c.name} className="relative">
            <span className="sr-only">{c.label}</span>
            <select
              value={c.value}
              onChange={(e) => onChange(c, e.target.value)}
              className="h-9 cursor-pointer appearance-none rounded-full border border-line bg-surface pl-3.5 pr-8 text-sm outline-none transition hover:border-fg/30 focus:border-fg/50"
            >
              {c.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted">▼</span>
          </label>
        ))}
      </div>
      <div className={cn("sm:hidden", className)}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-10 items-center gap-2 rounded-full border border-line bg-surface px-4 text-sm font-medium"
        >
          <SlidersHorizontal className="size-4" /> Filters &amp; sort
          {active > 0 && <span className="rounded-full bg-accent px-1.5 text-xs font-bold text-white">{active}</span>}
        </button>
        <Modal open={open} onClose={() => setOpen(false)} label="Filters and sort">
          <div className="space-y-4 p-5">
            <h2 className="text-lg font-bold">Filters &amp; sort</h2>
            {controls.map((c) => (
              <label key={c.name} className="block">
                <span className="mb-1.5 block text-sm text-muted">{c.label}</span>
                <select
                  value={c.value}
                  onChange={(e) => onChange(c, e.target.value)}
                  className="h-12 w-full appearance-none rounded-lg border border-line bg-bg px-3 outline-none focus:border-fg/50"
                >
                  {c.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <button type="button" onClick={() => setOpen(false)} className="h-12 w-full rounded-lg bg-fg font-semibold text-bg">
              {pending ? "Updating…" : "Done"}
            </button>
          </div>
        </Modal>
      </div>
    </>
  );
}

const RATING_VALUES = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "none"];

/**
 * Pick any set of ratings: click to toggle one, shift-click to select a range (e.g. 7 then shift-click 10).
 * Stored in the URL as ?r=7,8,9,10 ("none" = unrated).
 */
export function RatingFilter({ selected, counts, params }: { selected: string[]; counts: Record<string, number>; params: Params }) {
  const { update, pending } = useQueryUpdater(params);
  const anchor = useRef<string | null>(null);

  const apply = (values: Set<string>) => {
    const ordered = RATING_VALUES.filter((v) => values.has(v));
    // Drop the legacy ?min= param so it can't come back when the chips are cleared.
    update("r", ordered.length ? ordered.join(",") : null, ["min"]);
  };

  const click = (value: string, shift: boolean) => {
    const next = new Set(selected);
    if (shift && anchor.current && value !== "none" && anchor.current !== "none") {
      const [lo, hi] = [Number(anchor.current), Number(value)].sort((a, b) => a - b);
      for (let n = lo; n <= hi; n++) next.add(String(n));
    } else if (next.has(value)) {
      next.delete(value);
    } else {
      next.add(value);
    }
    anchor.current = value;
    apply(next);
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 transition-opacity", pending && "opacity-60")}>
      <span className="text-sm text-muted">Your rating</span>
      <div className="flex flex-wrap gap-1">
        {RATING_VALUES.map((value) => {
          const on = selected.includes(value);
          const count = counts[value] ?? 0;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={on}
              aria-label={value === "none" ? `Unrated (${count})` : `Rated ${value} (${count})`}
              onClick={(e) => click(value, e.shiftKey)}
              title={value === "none" ? "Watched but not rated" : `${value}/10 · shift-click to select a range`}
              className={cn(
                "flex h-11 min-w-10 flex-col items-center justify-center rounded-md border px-2 leading-none transition",
                on ? "border-gold bg-gold text-black" : "border-line bg-surface hover:border-fg/30",
                !on && count === 0 && "opacity-40",
              )}
            >
              <span className="text-sm font-bold">{value === "none" ? "Unrated" : value}</span>
              <span className={cn("mt-1 text-[10px] tabular-nums", on ? "text-black/70" : "text-dim")}>{count}</span>
            </button>
          );
        })}
      </div>
      {selected.length > 0 && (
        <button type="button" onClick={() => apply(new Set())} className="text-xs text-muted hover:text-fg">
          Clear
        </button>
      )}
      <span className="hidden text-[11px] text-dim lg:inline">Tip: click 7, then shift-click 10 to pick 7–10</span>
    </div>
  );
}
