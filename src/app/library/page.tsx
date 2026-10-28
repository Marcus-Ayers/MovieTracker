import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/page";
import { LibraryView } from "@/components/profile/library-view";
import { SignInNotice } from "@/components/profile/profile-nav";
import { getCurrentUser } from "@/lib/auth";

/**
 * /library — your library (the view itself, shared with public profiles, is components/profile/library-view.tsx).
 */

export const metadata: Metadata = { title: "Library" };

async function MyLibrary({ searchParams }: { searchParams: PageProps<"/library">["searchParams"] }) {
  const user = await getCurrentUser();
  if (!user) return <SignInNotice section="library" />;
  return <LibraryView profile={user} isOwn base="" searchParams={searchParams} />;
}

export default function LibraryPage(props: PageProps<"/library">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <MyLibrary searchParams={props.searchParams} />
    </Suspense>
  );
}
