import type { Metadata } from "next";
import { Suspense } from "react";
import { DynamicMarker } from "@/components/dynamic-marker";
import { PageSkeleton } from "@/components/page";
import { LibraryView } from "@/components/profile/library-view";
import { openProfile } from "@/components/profile/profile-nav";

/**
 * /u/[username]/library — someone's library on their public profile, if their privacy setting lets you see it.
 */

export async function generateMetadata(props: PageProps<"/u/[username]/library">): Promise<Metadata> {
  const { username } = await props.params;
  return { title: `@${username} · Library` };
}

async function ProfileLibrary({ params, searchParams }: PageProps<"/u/[username]/library">) {
  const result = await openProfile(params);
  return "notice" in result ? result.notice : <LibraryView {...result.view} searchParams={searchParams} />;
}

export default function ProfileLibraryPage(props: PageProps<"/u/[username]/library">) {
  return (
    <>
      <Suspense fallback={<PageSkeleton />}>
        <ProfileLibrary params={props.params} searchParams={props.searchParams} />
      </Suspense>
      <DynamicMarker />
    </>
  );
}
