import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/page";
import { DiaryView } from "@/components/profile/diary-view";
import { SignInNotice } from "@/components/profile/profile-nav";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Diary" };

async function MyDiary({ searchParams }: { searchParams: PageProps<"/diary">["searchParams"] }) {
  const user = await getCurrentUser();
  if (!user) return <SignInNotice section="diary" />;
  return <DiaryView profile={user} isOwn base="" searchParams={searchParams} />;
}

export default function DiaryPage(props: PageProps<"/diary">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <MyDiary searchParams={props.searchParams} />
    </Suspense>
  );
}
