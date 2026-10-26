import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { PosterCard } from "@/components/media/poster-card";
import { myRatingFor } from "@/components/media/rows";
import { MissingKey } from "@/components/missing-key";
import { EmptyState, PageHeader, PageSkeleton } from "@/components/page";
import { getCurrentUser } from "@/lib/auth";
import { MEDIA_LABEL, tmdbImage } from "@/lib/format";
import { getWatchedMap } from "@/lib/library";
import { hasTmdbKey, searchTitles } from "@/lib/tmdb";

export const metadata: Metadata = { title: "Search" };

async function Results({ searchParams }: { searchParams: PageProps<"/search">["searchParams"] }) {
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim() : "";
  if (!query) {
    return (
      <>
        <PageHeader title="Search" />
        <EmptyState title="Search for a movie, show, or person">Press / or ⌘K anywhere to open search.</EmptyState>
      </>
    );
  }

  const user = await getCurrentUser();
  const [{ items, people }, watched] = await Promise.all([searchTitles(query), user ? getWatchedMap(user.id) : null]);

  return (
    <>
      <PageHeader title={<>Results for “{query}”</>} subtitle={`${items.length} titles${people.length ? ` · ${people.length} people` : ""}`} />
      {people.length > 0 && (
        <div className="no-scrollbar mb-10 flex gap-5 overflow-x-auto px-4 sm:px-8 lg:px-12">
          {people.map((p) => (
            <Link key={p.id} href={`/person/${p.id}`} className="group/p w-24 shrink-0 text-center">
              <div className="relative mx-auto size-24 overflow-hidden rounded-full bg-surface-2 ring-1 ring-white/5 group-hover/p:ring-2 group-hover/p:ring-fg/60">
                {p.profilePath && <Image src={tmdbImage(p.profilePath, "w185")!} alt="" fill sizes="96px" className="object-cover" />}
              </div>
              <p className="mt-2 truncate text-sm font-medium">{p.name}</p>
              <p className="text-xs text-dim">{p.knownFor}</p>
            </Link>
          ))}
        </div>
      )}
      {items.length === 0 ? (
        <EmptyState title="No movies or shows found">Try a different spelling, or search by the original title.</EmptyState>
      ) : (
        <div className="grid grid-cols-3 gap-x-3 gap-y-5 px-4 sm:grid-cols-4 sm:px-8 md:grid-cols-5 lg:grid-cols-6 lg:px-12 xl:grid-cols-8">
          {items.map((item) => (
            <PosterCard
              key={`${item.mediaType}-${item.id}`}
              item={item}
              myRating={myRatingFor(watched, item)}
              sizes="(min-width: 1280px) 12vw, (min-width: 768px) 18vw, 30vw"
              subtitle={`${MEDIA_LABEL[item.mediaType]}${item.year ? ` · ${item.year}` : ""}`}
            />
          ))}
        </div>
      )}
    </>
  );
}

export default function SearchPage(props: PageProps<"/search">) {
  if (!hasTmdbKey()) return <MissingKey />;
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Results searchParams={props.searchParams} />
    </Suspense>
  );
}
