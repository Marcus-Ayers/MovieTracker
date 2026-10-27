import { LayoutList, Rows3 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { cn, plural, tmdbImage } from "@/lib/format";

/** A list on a grid of lists: fanned-out posters, its name, and how many titles (and how many you've seen). */
export function ListCard({
  href,
  name,
  kind,
  count,
  posters,
  seen,
  by,
}: {
  href: string;
  name: string;
  kind: "list" | "tier";
  count: number;
  posters: (string | null)[];
  seen?: number;
  by?: string;
}) {
  return (
    <Link href={href} className="group block">
      <div className="relative h-36 overflow-hidden rounded-xl border border-line bg-surface p-3 transition group-hover:border-fg/30">
        {posters.slice(0, 4).map((p, i) => (
          <span
            key={i}
            className="absolute bottom-3 aspect-[2/3] w-[34%] overflow-hidden rounded-md bg-surface-3 shadow-lg shadow-black/60 ring-1 ring-black/40"
            style={{ left: `${6 + i * 19}%`, zIndex: 10 - i }}
          >
            {p && <Image src={tmdbImage(p, "w185")!} alt="" fill sizes="120px" className="object-cover" />}
          </span>
        ))}
        {!posters.length && <span className="grid h-full place-items-center text-sm text-dim">Empty</span>}
        <span className="absolute right-2 top-2 z-20 inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-semibold text-fg">
          {kind === "tier" ? <Rows3 className="size-3" /> : <LayoutList className="size-3" />}
          {kind === "tier" ? "Tier list" : "List"}
        </span>
      </div>
      <p className="mt-2.5 font-semibold leading-snug group-hover:underline group-hover:decoration-accent group-hover:underline-offset-4">{name}</p>
      <p className="mt-0.5 text-xs text-dim">
        {plural(count, "title")}
        {by && <> · by {by}</>}
      </p>
      {seen !== undefined && count > 0 && (
        <div className="mt-2 flex items-center gap-2">
          <span className="h-1 flex-1 overflow-hidden rounded-full bg-surface-3">
            <span className={cn("block h-full rounded-full", seen === count ? "bg-gold" : "bg-accent")} style={{ width: `${(seen / count) * 100}%` }} />
          </span>
          <span className="text-[11px] tabular-nums text-muted">
            {seen}/{count} seen
          </span>
        </div>
      )}
    </Link>
  );
}
