import type { Metadata } from "next";
import { Suspense } from "react";
import { DynamicMarker } from "@/components/dynamic-marker";
import { PageSkeleton } from "@/components/page";
import { DiaryView } from "@/components/profile/diary-view";
import { openProfile } from "@/components/profile/profile-nav";

export async function generateMetadata(props: PageProps<"/u/[username]/diary">): Promise<Metadata> {
  const { username } = await props.params;
  return { title: `@${username} · Diary` };
}

async function ProfileDiary({ params, searchParams }: PageProps<"/u/[username]/diary">) {
  const result = await openProfile(params);
  return "notice" in result ? result.notice : <DiaryView {...result.view} searchParams={searchParams} />;
}

export default function ProfileDiaryPage(props: PageProps<"/u/[username]/diary">) {
  return (
    <>
      <Suspense fallback={<PageSkeleton />}>
        <ProfileDiary params={props.params} searchParams={props.searchParams} />
      </Suspense>
      <DynamicMarker />
    </>
  );
}
