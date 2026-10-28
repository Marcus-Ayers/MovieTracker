import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DynamicMarker } from "@/components/dynamic-marker";
import { TierBoard } from "@/components/lists/list-boards";
import { CopyListButton } from "@/components/lists/list-controls";
import { PosterCard } from "@/components/media/poster-card";
import { myRatingFor } from "@/components/media/rows";
import { PageSkeleton } from "@/components/page";
import { getCurrentUser } from "@/lib/auth";
import { getCurated } from "@/lib/curated";
import { cn, plural } from "@/lib/format";
import { getWatchedMap, watchedKey } from "@/lib/library";
import { internetTiers, loadCuratedTitles } from "@/lib/lists";
import { DEFAULT_TIERS } from "@/lib/tiers";

/**
 * /lists/featured/[slug] — a featured list (numbered if it's "in order") or a tier list ranked by IMDb ratings,
 * with how many you've seen and a button to copy it into your own lists.
 */

export async function generateMetadata(props: PageProps<"/lists/featured/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  return { title: getCurated(slug)?.title ?? "List" };
}

async function Featured({ params }: { params: PageProps<"/lists/featured/[slug]">["params"] }) {
  const { slug } = await params;
  const curated = getCurated(slug);
  if (!curated) notFound();
  const user = await getCurrentUser();
  const [titles, watched] = await Promise.all([loadCuratedTitles(curated), user ? getWatchedMap(user.id) : null]);
  const seen = watched ? titles.filter((t) => watchedKey("movie", t.tmdbId) in watched).length : null;
  const tier = curated.kind === "tier";

  return (
    <div className="px-4 pb-12 pt-28 sm:px-8 lg:px-12">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-3xl">
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-accent">
            <Link href="/lists" className="hover:underline">
              {tier ? "Featured tier list" : "Featured list"}
            </Link>
          </p>
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">{curated.title}</h1>
          <p className="mt-2 text-muted">{curated.description}</p>
          <p className="mt-3 text-sm text-dim">
            {plural(titles.length, "film")}
            {seen !== null && (
              <>
                {" · "}
                <span className={cn(seen === titles.length ? "text-gold" : "text-fg")}>
                  you&apos;ve seen {seen} of {titles.length}
                </span>
              </>
            )}
          </p>
          {seen !== null && (
            <div className="mt-2 h-1.5 max-w-sm overflow-hidden rounded-full bg-surface-3">
              <div className="h-full rounded-full bg-accent" style={{ width: `${(seen / Math.max(1, titles.length)) * 100}%` }} />
            </div>
          )}
        </div>
        {user ? (
          <CopyListButton slug={slug} label={tier ? "Rank them yourself" : "Make it mine"} />
        ) : (
          <Link href={`/sign-in?redirect_url=/lists/featured/${slug}`} className="rounded border border-line px-4 py-2 text-sm hover:border-fg/40">
            Sign in to make your own
          </Link>
        )}
      </div>

      {tier ? (
        <>
          <TierBoard initialTiers={DEFAULT_TIERS} initialItems={await internetTiers(titles)} editable={false} />
          <p className="mt-4 max-w-3xl text-xs text-dim">
            Tiers come from IMDb ratings (TMDB&apos;s where IMDb has none), relative to the rest of this list: roughly the top 15% are S, the
            next 25% A, and so on. Anything under 6/10 lands in F. They move as the ratings do.
          </p>
        </>
      ) : (
        <div className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
          {titles.map((t, i) => {
            const item = { id: t.tmdbId, mediaType: t.mediaType, title: t.title, year: t.year, posterPath: t.posterPath, genres: t.genres.map((g) => g.name) };
            return (
              <PosterCard
                key={t.id}
                item={item}
                myRating={myRatingFor(watched, item)}
                sizes="(min-width: 1280px) 12vw, (min-width: 768px) 18vw, 30vw"
                subtitle={[curated.ordered ? `#${i + 1}` : null, t.year].filter(Boolean).join(" · ")}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function FeaturedListPage(props: PageProps<"/lists/featured/[slug]">) {
  return (
    <>
      <Suspense fallback={<PageSkeleton />}>
        <Featured params={props.params} />
      </Suspense>
      <DynamicMarker />
    </>
  );
}
