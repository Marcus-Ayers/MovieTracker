import type { Metadata } from "next";
import { Suspense } from "react";
import { DynamicMarker } from "@/components/dynamic-marker";
import { PageSkeleton } from "@/components/page";
import { openProfile } from "@/components/profile/profile-nav";
import { RecapYears } from "@/components/recap/recap-view";

export async function generateMetadata(props: PageProps<"/u/[username]/recap">): Promise<Metadata> {
  const { username } = await props.params;
  return { title: `@${username} · Year in review` };
}

async function ProfileRecaps({ params }: Pick<PageProps<"/u/[username]/recap">, "params">) {
  const result = await openProfile(params);
  return "notice" in result ? result.notice : <RecapYears {...result.view} />;
}

export default function ProfileRecapsPage(props: PageProps<"/u/[username]/recap">) {
  return (
    <>
      <Suspense fallback={<PageSkeleton />}>
        <ProfileRecaps params={props.params} />
      </Suspense>
      <DynamicMarker />
    </>
  );
}
