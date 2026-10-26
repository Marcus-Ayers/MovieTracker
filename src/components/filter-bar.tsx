"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { cn } from "@/lib/format";

export type FilterControl = {
  name: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
};

/** A row of dropdowns that write their values into the URL. Current values come from the server. */
export function FilterBar({ controls, className }: { controls: FilterControl[]; className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  const update = (name: string, value: string) => {
    const params = new URLSearchParams();
    for (const c of controls) {
      const v = c.name === name ? value : c.value;
      if (v && v !== c.options[0]?.value) params.set(c.name, v);
    }
    const query = params.toString();
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  };

  return (
    <div className={cn("flex flex-wrap gap-2 transition-opacity", pending && "opacity-60", className)}>
      {controls.map((c) => (
        <label key={c.name} className="relative">
          <span className="sr-only">{c.label}</span>
          <select
            value={c.value}
            onChange={(e) => update(c.name, e.target.value)}
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
  );
}
