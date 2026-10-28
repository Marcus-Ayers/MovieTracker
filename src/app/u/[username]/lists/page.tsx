import type { Metadata } from "next";
import { Suspense } from "react";
import { DynamicMarker } from "@/components/dynamic-marker";
import { PageSkeleton } from "@/components/page";
import { ListsView } from "@/components/profile/lists-view";
import { openProfile } from "@/components/profile/profile-nav";

/**
 * /u/[username]/lists — someone's lists and tier lists, if their privacy setting lets you see them.
 */

export async function generateMetadata(props: PageProps<"/u/[username]/lists">): Promise<Metadata> {
  const { username } = await props.params;
  return { title: `@${username} · Lists` };
}

async function ProfileLists({ params }: Pick<PageProps<"/u/[username]/lists">, "params">) {
  const result = await openProfile(params);
  return "notice" in result ? result.notice : <ListsView {...result.view} />;
}

export default function ProfileListsPage(props: PageProps<"/u/[username]/lists">) {
  return (
    <>
      <Suspense fallback={<PageSkeleton />}>
        <ProfileLists params={props.params} />
      </Suspense>
      <DynamicMarker />
    </>
  );
}
