import type { Metadata } from "next";
import { Suspense } from "react";
import { PosterCard } from "@/components/media/poster-card";
import { EmptyState, NoOwnerNotice, PageHeader, PageSkeleton, PrivateNotice } from "@/components/page";
import { getProfileAccess } from "@/lib/auth";
import { plural } from "@/lib/format";
import { getWatchlist } from "@/lib/library";

export const metadata: Metadata = { title: "Watchlist" };

async function Watchlist() {
  const access = await getProfileAccess();
  if (access.status === "no-owner") return <NoOwnerNotice />;
  if (access.status === "private") return <PrivateNotice name={access.owner.displayName} />;
  const titles = await getWatchlist(access.owner.id);

  return (
    <>
      <PageHeader title={access.isOwner ? "Your watchlist" : `${access.owner.displayName}'s watchlist`} subtitle={plural(titles.length, "title")} />
      {titles.length === 0 ? (
        <EmptyState title="Nothing on the watchlist">Hit “Watchlist” on any movie or show to save it for later.</EmptyState>
      ) : (
        <div className="grid grid-cols-3 gap-x-3 gap-y-5 px-4 sm:grid-cols-4 sm:px-8 md:grid-cols-5 lg:grid-cols-6 lg:px-12 xl:grid-cols-8">
          {titles.map((t) => (
            <PosterCard
              key={t.id}
              item={{ id: t.tmdbId, mediaType: t.mediaType, title: t.title, year: t.year, posterPath: t.posterPath, voteAverage: t.voteAverage }}
              sizes="(min-width: 1280px) 12vw, (min-width: 768px) 18vw, 30vw"
            />
          ))}
        </div>
      )}
    </>
  );
}

export default function WatchlistPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Watchlist />
    </Suspense>
  );
}
