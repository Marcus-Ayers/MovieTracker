import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { ListCard } from "@/components/lists/list-card";
import { NewListButton } from "@/components/lists/list-controls";
import { PageHeader, PageSkeleton } from "@/components/page";
import { getCurrentUser } from "@/lib/auth";
import { CURATED } from "@/lib/curated";
import { getWatchedMap, watchedKey } from "@/lib/library";
import { getCuratedPosters, getListSummaries } from "@/lib/lists";

/**
 * /lists — your lists and tier lists, plus the featured ones everyone sees (lib/curated.ts).
 */

export const metadata: Metadata = { title: "Lists" };

const grid = "grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="px-4 sm:px-8 lg:px-12">
      <h2 className="mb-4 text-lg font-semibold tracking-tight sm:text-xl">{title}</h2>
      {children}
    </section>
  );
}

async function Lists() {
  const user = await getCurrentUser();
  const [mine, watched, posters] = await Promise.all([
    user ? getListSummaries(user.id) : [],
    user ? getWatchedMap(user.id) : null,
    getCuratedPosters(CURATED),
  ]);
  const featured = (kind: "list" | "tier") =>
    CURATED.filter((l) => l.kind === kind).map((l) => (
      <ListCard
        key={l.slug}
        href={`/lists/featured/${l.slug}`}
        name={l.title}
        kind={l.kind}
        count={l.items.length}
        posters={posters.get(l.slug) ?? []}
        seen={watched ? l.items.filter(([id]) => watchedKey("movie", id) in watched).length : undefined}
      />
    ));

  return (
    <>
      <PageHeader title="Lists" subtitle="Make your own lists and tier lists, or start from one of these.">
        {user && (
          <div className="flex flex-wrap gap-2">
            <NewListButton kind="list" primary />
            <NewListButton kind="tier" />
          </div>
        )}
      </PageHeader>
      <div className="space-y-14 pb-12">
        {user ? (
          <Section title="Your lists">
            {mine.length ? (
              <div className={grid}>
                {mine.map((l) => (
                  <ListCard key={l.id} {...l} />
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted">
                No lists yet. Make one above, or open a featured list and hit &ldquo;Make it mine&rdquo;.
              </p>
            )}
          </Section>
        ) : (
          <p className="px-4 text-sm text-muted sm:px-8 lg:px-12">
            <Link href="/sign-in?redirect_url=/lists" className="text-fg underline decoration-accent underline-offset-4">
              Sign in
            </Link>{" "}
            to make your own lists and tier lists.
          </p>
        )}
        <Section title="Featured lists">
          <div className={grid}>{featured("list")}</div>
        </Section>
        <Section title="Tier lists, ranked by the internet">
          <div className={grid}>{featured("tier")}</div>
        </Section>
      </div>
    </>
  );
}

export default function ListsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Lists />
    </Suspense>
  );
}
