import { Search, Users } from "lucide-react";
import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { FriendButton } from "@/components/friends/friend-button";
import { ActivityList, PersonRow } from "@/components/friends/friend-lists";
import { Notice, PageHeader, PageSkeleton } from "@/components/page";
import { requireUser } from "@/lib/auth";
import { plural } from "@/lib/format";
import { getFriendActivity, getFriendsOverview, searchPeople, type Relation } from "@/lib/friends";

/**
 * /friends — what friends watched, friend requests, finding people, and your friends list. Shows a notice instead
 * when social features are off.
 */

export const metadata: Metadata = { title: "Friends" };

function Panel({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted">{title}</h2>
      {children}
    </section>
  );
}

async function Friends({ searchParams }: { searchParams: PageProps<"/friends">["searchParams"] }) {
  const user = await requireUser("/friends");
  if (!user.social) {
    return (
      <Notice icon={<Users className="size-6" />} title="Social features are off">
        <p className="mb-6">Turn them on to add friends, see what they&apos;re watching, and compare ratings.</p>
        <Link href="/settings#social" className="rounded bg-accent px-5 py-2.5 font-semibold text-white hover:bg-accent-hover">
          Open Settings
        </Link>
      </Notice>
    );
  }

  const { q } = await searchParams;
  const query = typeof q === "string" ? q.slice(0, 60) : "";
  const [overview, activity, results] = await Promise.all([
    getFriendsOverview(user.id),
    getFriendActivity(user.id, 60),
    query ? searchPeople(user.id, query) : Promise.resolve([]),
  ]);
  const relationTo = (id: number): Relation =>
    overview.friends.some((p) => p.id === id)
      ? "friends"
      : overview.incoming.some((p) => p.id === id)
        ? "incoming"
        : overview.outgoing.some((p) => p.id === id)
          ? "outgoing"
          : "none";

  return (
    <>
      <PageHeader
        title="Friends"
        subtitle={[plural(overview.friends.length, "friend"), overview.incoming.length ? plural(overview.incoming.length, "request") : null]
          .filter(Boolean)
          .join(" · ")}
      />
      <div className="grid gap-10 px-4 pb-12 sm:px-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-12">
        <section className="min-w-0">
          <h2 className="mb-2 text-lg font-semibold tracking-tight">What friends watched</h2>
          {activity.length ? (
            <ActivityList items={activity} />
          ) : (
            <p className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted">
              {overview.friends.length
                ? "Nothing yet. When your friends log something, it shows up here."
                : "Add some friends and their diaries show up here."}
            </p>
          )}
        </section>

        <aside className="space-y-6">
          {overview.incoming.length > 0 && (
            <Panel title={<>Friend requests <span className="text-accent">{overview.incoming.length}</span></>}>
              <ul>
                {overview.incoming.map((p) => (
                  <PersonRow key={p.id} person={p}>
                    <FriendButton username={p.username} relation="incoming" size="sm" />
                  </PersonRow>
                ))}
              </ul>
            </Panel>
          )}

          <Panel title="Find people">
            <Form action="/friends" className="relative mb-1 mt-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-dim" />
              <input
                name="q"
                defaultValue={query}
                placeholder="Name or @username"
                autoComplete="off"
                className="h-10 w-full rounded-md border border-line bg-bg pl-9 pr-3 text-sm outline-none focus:border-fg/50"
              />
            </Form>
            {query && (
              <ul>
                {results.map((p) => (
                  <PersonRow key={p.id} person={p}>
                    <FriendButton username={p.username} relation={relationTo(p.id)} size="sm" />
                  </PersonRow>
                ))}
                {!results.length && <li className="py-3 text-sm text-dim">Nobody found for “{query}”.</li>}
              </ul>
            )}
            {!user.friendRequests && (
              <p className="mt-3 text-xs text-dim">
                You&apos;re hidden from search and can&apos;t get requests.{" "}
                <Link href="/settings#social" className="underline hover:text-fg">
                  Change
                </Link>
              </p>
            )}
          </Panel>

          <Panel title={`Your friends · ${overview.friends.length}`}>
            {overview.friends.length ? (
              <ul>
                {overview.friends.map((p) => (
                  <PersonRow key={p.id} person={p}>
                    <FriendButton username={p.username} relation="friends" size="sm" />
                  </PersonRow>
                ))}
              </ul>
            ) : (
              <p className="py-2 text-sm text-dim">No friends yet. Search above, or share your profile link: /u/{user.username}</p>
            )}
          </Panel>

          {overview.outgoing.length > 0 && (
            <Panel title="Sent requests">
              <ul>
                {overview.outgoing.map((p) => (
                  <PersonRow key={p.id} person={p}>
                    <FriendButton username={p.username} relation="outgoing" size="sm" />
                  </PersonRow>
                ))}
              </ul>
            </Panel>
          )}
        </aside>
      </div>
    </>
  );
}

export default function FriendsPage(props: PageProps<"/friends">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Friends searchParams={props.searchParams} />
    </Suspense>
  );
}
