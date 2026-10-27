import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/page";
import { SignInNotice } from "@/components/profile/profile-nav";
import { WatchlistView } from "@/components/profile/watchlist-view";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Watchlist" };

async function MyWatchlist({ searchParams }: { searchParams: PageProps<"/watchlist">["searchParams"] }) {
  const user = await getCurrentUser();
  if (!user) return <SignInNotice section="watchlist" />;
  return <WatchlistView profile={user} isOwn base="" searchParams={searchParams} />;
}

export default function WatchlistPage(props: PageProps<"/watchlist">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <MyWatchlist searchParams={props.searchParams} />
    </Suspense>
  );
}
