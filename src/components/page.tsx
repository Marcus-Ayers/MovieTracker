import { Lock } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/format";

export function PageHeader({ title, subtitle, children, className }: { title: ReactNode; subtitle?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <header className={cn("flex flex-wrap items-end justify-between gap-4 px-4 pb-6 pt-28 sm:px-8 lg:px-12", className)}>
      <div>
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
      </div>
      {children}
    </header>
  );
}

export function Notice({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-lg px-4 pb-10 pt-36 text-center">
      <div className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-surface-2 text-accent">{icon}</div>
      <h1 className="mb-2 text-2xl font-bold">{title}</h1>
      <div className="text-muted">{children}</div>
    </div>
  );
}

export function PrivateNotice({ name, friendsOnly = false, children }: { name: string; friendsOnly?: boolean; children?: ReactNode }) {
  return (
    <Notice icon={<Lock className="size-6" />} title={friendsOnly ? "Friends only" : "This profile is private"}>
      <p>{friendsOnly ? `Only ${name}'s friends can see their diary, reviews, and stats.` : `${name} has chosen to keep their diary, reviews, and stats private.`}</p>
      {children && <div className="mt-6 flex justify-center">{children}</div>}
    </Notice>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mx-4 rounded-xl border border-dashed border-line px-6 py-16 text-center sm:mx-8 lg:mx-12">
      <p className="text-lg font-semibold">{title}</p>
      {children && <div className="mt-2 text-sm text-muted">{children}</div>}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="px-4 pt-28 sm:px-8 lg:px-12">
      <div className="mb-8 h-10 w-56 animate-pulse rounded bg-surface-2" />
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-7">
        {Array.from({ length: 14 }, (_, i) => (
          <div key={i} className="aspect-[2/3] animate-pulse rounded-md bg-surface-2" />
        ))}
      </div>
    </div>
  );
}
