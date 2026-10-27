import { PosterCard } from "@/components/media/poster-card";
import { EmptyState, PageHeader } from "@/components/page";
import { ProfileTabs, type ProfileViewProps } from "@/components/profile/profile-nav";
import { plural } from "@/lib/format";
import { getWatchlist } from "@/lib/library";

export async function WatchlistView({ profile, isOwn, base }: Omit<ProfileViewProps, "searchParams">) {
  const titles = await getWatchlist(profile.id);

  return (
    <>
      <PageHeader title={isOwn ? "Your watchlist" : `${profile.displayName}'s watchlist`} subtitle={plural(titles.length, "title")} />
      {base && <ProfileTabs profile={profile} base={base} active="watchlist" />}
      {titles.length === 0 ? (
        <EmptyState title="Nothing on the watchlist">{isOwn && "Hit “Watchlist” on any movie or show to save it for later."}</EmptyState>
      ) : (
        <div className="grid grid-cols-3 gap-x-3 gap-y-5 px-4 sm:grid-cols-4 sm:px-8 md:grid-cols-5 lg:grid-cols-6 lg:px-12 xl:grid-cols-8">
          {titles.map((t) => (
            <PosterCard
              key={t.id}
              item={{ id: t.tmdbId, mediaType: t.mediaType, title: t.title, year: t.year, posterPath: t.posterPath, genres: t.genres.map((g) => g.name) }}
              sizes="(min-width: 1280px) 12vw, (min-width: 768px) 18vw, 30vw"
            />
          ))}
        </div>
      )}
    </>
  );
}
