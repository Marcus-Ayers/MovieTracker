import type { Metadata } from "next";
import { Suspense } from "react";
import { EmptyState, PageHeader } from "@/components/page";
import { RateQueue } from "@/components/rate/rate-queue";
import { requireUser } from "@/lib/auth";
import { plural } from "@/lib/format";
import { getRateQueue } from "@/lib/rate-queue";

/**
 * /rate — the rating queue: everything you've watched without a rating, one card at a time
 * (components/rate/rate-queue.tsx).
 */

export const metadata: Metadata = { title: "Rate what you've watched" };

async function Queue() {
  const user = await requireUser("/rate");
  const { items, total } = await getRateQueue(user.id);
  return (
    <>
      <PageHeader
        title="Rate what you've watched"
        subtitle={total ? `${plural(total, "title")} without a rating · most recent first` : "Everything you've watched has a rating"}
      />
      {total === 0 ? (
        <EmptyState title="All caught up">New Plex watches and anything you log without a rating will show up here.</EmptyState>
      ) : (
        <div className="max-w-5xl px-4 pb-10 sm:px-8 lg:px-12">
          <RateQueue initialItems={items} initialTotal={total} />
        </div>
      )}
    </>
  );
}

export default function RatePage() {
  return (
    <Suspense
      fallback={
        <div className="px-4 pt-28 sm:px-8 lg:px-12">
          <div className="mb-8 h-10 w-72 animate-pulse rounded bg-surface-2" />
          <div className="flex gap-10">
            <div className="hidden aspect-[2/3] w-60 animate-pulse rounded-lg bg-surface-2 md:block" />
            <div className="flex-1 space-y-4">
              <div className="h-10 w-2/3 animate-pulse rounded bg-surface-2" />
              <div className="h-24 w-full animate-pulse rounded bg-surface-2" />
            </div>
          </div>
        </div>
      }
    >
      <Queue />
    </Suspense>
  );
}
