import { Info, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { BrowseSkeleton } from "@/components/browse/browse-content";
import { ShuffleButton } from "@/components/explore/shuffle-button";
import { PosterRow } from "@/components/media/rows";
import { MissingKey } from "@/components/missing-key";
import { WatchlistButton } from "@/components/title/title-buttons";
import { getCurrentUser } from "@/lib/auth";
import { buildExplore, randomSeed, type ExplorePick } from "@/lib/explore";
import { formatRuntime, titleHref, tmdbImage } from "@/lib/format";
import { getTitleState } from "@/lib/library";
import { hasTmdbKey } from "@/lib/tmdb";

export const metadata: Metadata = { title: "Explore" };

async function PickHero({ pick, userId }: { pick: ExplorePick; userId: number | null }) {
  const d = pick.details;
  const state = userId ? await getTitleState(userId, d.id, "movie") : null;
  const runtime = formatRuntime(d.runtime);
  return (
    <section className="relative min-h-[560px] overflow-hidden sm:h-[78vh] sm:max-h-[780px]">
      {d.backdropPath && (
        <Image src={tmdbImage(d.backdropPath, "original")!} alt="" fill preload sizes="100vw" className="object-cover object-[center_20%]" />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/70 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-bg via-bg/70 to-transparent" />
      <div className="relative flex h-full min-h-[560px] items-end px-4 pb-16 pt-28 sm:px-8 lg:px-12">
        <div className="max-w-xl">
          <p className="mb-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-accent">
            <Sparkles className="size-4" /> Tonight&apos;s pick · {pick.reason}
          </p>
          {d.logoPath ? (
            <div className="relative mb-5 h-24 max-w-md sm:h-32">
              <Image src={tmdbImage(d.logoPath, "w500")!} alt={d.title} fill sizes="450px" className="object-contain object-left-bottom drop-shadow-[0_4px_24px_rgba(0,0,0,0.8)]" />
            </div>
          ) : (
            <h1 className="mb-4 text-4xl font-black leading-none tracking-tight sm:text-6xl">{d.title}</h1>
          )}
          <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
            {d.year && <span className="font-medium">{d.year}</span>}
            {runtime && <span>{runtime}</span>}
            <span className="text-muted">{d.genres.slice(0, 3).map((g) => g.name).join(" · ")}</span>
            {pick.ratings?.imdb && (
              <span className="inline-flex items-center gap-1 font-semibold">
                <span className="rounded-sm bg-gold px-1 text-[11px] font-black text-black">IMDb</span>
                {pick.ratings.imdb}
              </span>
            )}
            {pick.ratings?.rottenTomatoes && <span className="font-semibold">🍅 {pick.ratings.rottenTomatoes}</span>}
          </div>
          {d.directors.length > 0 && <p className="mb-3 text-sm text-muted">Directed by {d.directors.map((p) => p.name).join(", ")}</p>}
          <p className="mb-6 line-clamp-4 leading-relaxed text-fg/85">{d.overview}</p>
          <div className="flex flex-wrap gap-3">
            <Link href={titleHref("movie", d.id)} className="inline-flex items-center gap-2 rounded bg-white px-6 py-2.5 font-semibold text-black transition hover:bg-white/80">
              <Info className="size-5" /> More info
            </Link>
            <ShuffleButton label="Shuffle" />
            {state && <WatchlistButton tmdbId={d.id} mediaType="movie" onWatchlist={state.onWatchlist} />}
          </div>
        </div>
      </div>
    </section>
  );
}

async function Explore({ searchParams }: { searchParams: PageProps<"/explore">["searchParams"] }) {
  const { seed: seedParam } = await searchParams;
  // The seed lives in the URL so the page stays put while you use it (e.g. adding to your watchlist);
  // arriving without one starts a fresh shuffle.
  const seed = Number(seedParam);
  if (!Number.isInteger(seed) || seed <= 0) {
    await connection(); // a random value has to be made per request, not during prerendering
    redirect(`/explore?seed=${randomSeed()}`);
  }
  const user = await getCurrentUser();
  const { pick, rows, watched } = await buildExplore(seed, user?.id ?? null);

  return (
    <>
      {pick ? <PickHero pick={pick} userId={user?.id ?? null} /> : <div className="h-28" />}
      <div className="relative z-10 space-y-9 sm:-mt-8">
        {!user && (
          <p className="px-4 text-sm text-muted sm:px-8 lg:px-12">
            <Link href="/login" className="text-fg underline decoration-accent underline-offset-4">
              Sign in
            </Link>{" "}
            for recommendations based on what you&apos;ve watched.
          </p>
        )}
        {rows.map((row) => (
          <PosterRow key={row.key} title={row.title} subtitle={row.subtitle} items={row.items} watched={watched} href={row.href} />
        ))}
        <div className="flex justify-center pt-4">
          <ShuffleButton label="Shuffle everything" className="border border-line bg-surface hover:border-fg/40" />
        </div>
      </div>
    </>
  );
}

export default function ExplorePage(props: PageProps<"/explore">) {
  if (!hasTmdbKey()) return <MissingKey />;
  return (
    <Suspense fallback={<BrowseSkeleton />}>
      <Explore searchParams={props.searchParams} />
    </Suspense>
  );
}
