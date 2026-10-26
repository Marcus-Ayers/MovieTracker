"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { cn } from "@/lib/format";

/** "Include entries with no date" switch for the Stats page. Remembers your choice. */
export function UndatedToggle({ include, count }: { include: boolean; count: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const set = (next: boolean) => {
    document.cookie = `stats_dated=${next ? "0" : "1"}; path=/; max-age=31536000; samesite=lax`;
    const params = new URLSearchParams(searchParams.toString());
    params.set("dated", next ? "0" : "1");
    startTransition(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }));
  };

  return (
    <label className={cn("flex w-fit cursor-pointer items-center gap-3 rounded-full border border-line bg-surface px-4 py-2 text-sm", pending && "opacity-60")}>
      <button
        type="button"
        role="switch"
        aria-checked={include}
        onClick={() => set(!include)}
        className={cn("relative h-5 w-9 shrink-0 rounded-full transition", include ? "bg-accent" : "bg-surface-3")}
      >
        <span className={cn("absolute top-0.5 size-4 rounded-full bg-white shadow transition-all", include ? "left-[18px]" : "left-0.5")} />
      </button>
      <span>
        Include entries with no date <span className="text-dim">({count.toLocaleString()})</span>
      </span>
    </label>
  );
}
