import type { Metadata } from "next";
import { Suspense } from "react";
import { DynamicMarker } from "@/components/dynamic-marker";
import { PageSkeleton } from "@/components/page";
import { openProfile } from "@/components/profile/profile-nav";
import { WatchlistView } from "@/components/profile/watchlist-view";

export async function generateMetadata(props: PageProps<"/u/[username]/watchlist">): Promise<Metadata> {
  const { username } = await props.params;
  return { title: `@${username} · Watchlist` };
}

async function ProfileWatchlist({ params }: Pick<PageProps<"/u/[username]/watchlist">, "params">) {
  const result = await openProfile(params);
  return "notice" in result ? result.notice : <WatchlistView {...result.view} />;
}

export default function ProfileWatchlistPage(props: PageProps<"/u/[username]/watchlist">) {
  return (
    <>
      <Suspense fallback={<PageSkeleton />}>
        <ProfileWatchlist params={props.params} />
      </Suspense>
      <DynamicMarker />
    </>
  );
}
