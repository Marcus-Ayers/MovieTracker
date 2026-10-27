import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ListBoard, TierBoard } from "@/components/lists/list-boards";
import { ListHeaderEditor } from "@/components/lists/list-controls";
import { PageSkeleton, PrivateNotice } from "@/components/page";
import { getCurrentUser, getProfileAccess } from "@/lib/auth";
import { getCurated } from "@/lib/curated";
import { plural } from "@/lib/format";
import { getList } from "@/lib/lists";

export const metadata: Metadata = { title: "List" };

async function ListView({ params }: { params: PageProps<"/lists/[id]">["params"] }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const data = await getList(id);
  if (!data) notFound();
  const { list, owner, items } = data;
  const viewer = await getCurrentUser();
  const isOwner = viewer?.id === owner.id;
  if (!isOwner) {
    // Lists follow the owner's profile privacy.
    const access = await getProfileAccess(owner.username);
    if (access.status !== "ok") return <PrivateNotice name={owner.displayName} friendsOnly={access.status === "private" && access.profile.visibility === "friends"} />;
  }
  const source = list.source ? getCurated(list.source) : null;

  return (
    <div className="px-4 pb-12 pt-28 sm:px-8 lg:px-12">
      <div className="mb-8 max-w-4xl">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-accent">
          {list.kind === "tier" ? "Tier list" : list.ranked ? "Ranked list" : "List"}
          <span className="font-normal normal-case tracking-normal text-dim">
            {" · by "}
            <Link href={`/u/${owner.username}/lists`} className="text-muted hover:text-fg hover:underline">
              {isOwner ? "you" : owner.displayName}
            </Link>
            {" · "}
            {plural(items.length, "title")}
            {source && (
              <>
                {" · started from "}
                <Link href={`/lists/featured/${source.slug}`} className="text-muted hover:text-fg hover:underline">
                  {source.title}
                </Link>
              </>
            )}
          </span>
        </p>
        {isOwner ? (
          <ListHeaderEditor listId={list.id} kind={list.kind} name={list.name} description={list.description} ranked={list.ranked} />
        ) : (
          <>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">{list.name}</h1>
            {list.description && <p className="mt-2 whitespace-pre-line text-muted">{list.description}</p>}
          </>
        )}
      </div>
      {list.kind === "tier" ? (
        <TierBoard listId={list.id} initialTiers={list.tiers} initialItems={items} editable={isOwner} />
      ) : (
        <ListBoard listId={list.id} initialItems={items} ranked={list.ranked} editable={isOwner} />
      )}
    </div>
  );
}

export default function ListPage(props: PageProps<"/lists/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ListView params={props.params} />
    </Suspense>
  );
}
