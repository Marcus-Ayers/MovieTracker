import type { Metadata } from "next";
import { Suspense } from "react";
import { DynamicMarker } from "@/components/dynamic-marker";
import { PageSkeleton } from "@/components/page";
import { openProfile } from "@/components/profile/profile-nav";
import { RecapView } from "@/components/recap/recap-view";
import { parseRecapYear } from "@/lib/recap-year";

export async function generateMetadata(props: PageProps<"/u/[username]/recap/[year]">): Promise<Metadata> {
  const { username, year } = await props.params;
  return { title: `@${username}'s ${year} in film`, description: `A year in movies and TV: top films, hours watched, favorite director and more.` };
}

async function ProfileRecap({ params }: Pick<PageProps<"/u/[username]/recap/[year]">, "params">) {
  const year = parseRecapYear((await params).year);
  const result = await openProfile(params);
  return "notice" in result ? result.notice : <RecapView {...result.view} year={year} />;
}

export default function ProfileRecapPage(props: PageProps<"/u/[username]/recap/[year]">) {
  return (
    <>
      <Suspense fallback={<PageSkeleton />}>
        <ProfileRecap params={props.params} />
      </Suspense>
      <DynamicMarker />
    </>
  );
}
