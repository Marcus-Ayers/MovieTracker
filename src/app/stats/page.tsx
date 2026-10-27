import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/page";
import { SignInNotice } from "@/components/profile/profile-nav";
import { StatsView } from "@/components/profile/stats-view";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Stats" };

async function MyStats({ searchParams }: { searchParams: PageProps<"/stats">["searchParams"] }) {
  const user = await getCurrentUser();
  if (!user) return <SignInNotice section="stats" />;
  return <StatsView profile={user} isOwn base="" searchParams={searchParams} />;
}

export default function StatsPage(props: PageProps<"/stats">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <MyStats searchParams={props.searchParams} />
    </Suspense>
  );
}
