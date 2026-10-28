import type { Metadata } from "next";
import { Suspense } from "react";
import { DynamicMarker } from "@/components/dynamic-marker";
import { PageSkeleton } from "@/components/page";
import { openProfile } from "@/components/profile/profile-nav";
import { StatsView } from "@/components/profile/stats-view";

/**
 * /u/[username]/stats — someone's stats on their public profile, if their privacy setting lets you see it.
 */

export async function generateMetadata(props: PageProps<"/u/[username]/stats">): Promise<Metadata> {
  const { username } = await props.params;
  return { title: `@${username} · Stats` };
}

async function ProfileStats({ params, searchParams }: PageProps<"/u/[username]/stats">) {
  const result = await openProfile(params);
  return "notice" in result ? result.notice : <StatsView {...result.view} searchParams={searchParams} />;
}

export default function ProfileStatsPage(props: PageProps<"/u/[username]/stats">) {
  return (
    <>
      <Suspense fallback={<PageSkeleton />}>
        <ProfileStats params={props.params} searchParams={props.searchParams} />
      </Suspense>
      <DynamicMarker />
    </>
  );
}
