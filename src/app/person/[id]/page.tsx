import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DynamicMarker } from "@/components/dynamic-marker";
import { PosterCard } from "@/components/media/poster-card";
import { myRatingFor, type WatchedMap } from "@/components/media/rows";
import { MissingKey } from "@/components/missing-key";
import { PageSkeleton } from "@/components/page";
import { getCurrentUser } from "@/lib/auth";
import { formatDate, tmdbImage } from "@/lib/format";
import { getWatchedMap } from "@/lib/library";
import { getPerson, hasTmdbKey, type PersonCredit, type PersonDetails } from "@/lib/tmdb";

export async function generateMetadata(props: PageProps<"/person/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  if (!hasTmdbKey()) return { title: "Person" };
  try {
    return { title: (await getPerson(Number(id))).name };
  } catch {
    return { title: "Person" };
  }
}

async function loadPerson(idParam: string): Promise<PersonDetails> {
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) notFound();
  try {
    return await getPerson(id);
  } catch (error) {
    if (error instanceof Error && error.message.includes("(404)")) notFound();
    throw error;
  }
}

function Filmography({
  title,
  credits,
  watched,
}: {
  title: string;
  credits: PersonCredit[];
  watched: WatchedMap | null;
}) {
  if (!credits.length) return null;
  const seen = watched ? credits.filter((c) => myRatingFor(watched, c) !== undefined) : [];
  const released = credits.filter((c) => c.date && c.date <= new Date().toISOString().slice(0, 10));
  return (
    <section>
      <div className="mb-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        {watched && (
          <p className="text-sm text-muted">
            You&apos;ve seen <span className="font-bold text-gold">{seen.length}</span> of {released.length}
          </p>
        )}
      </div>
      {watched && released.length > 0 && (
        <div className="mb-5 h-1.5 max-w-md overflow-hidden rounded-full bg-surface-3">
          <div className="h-full rounded-full bg-gold" style={{ width: `${Math.min(100, (seen.length / released.length) * 100)}%` }} />
        </div>
      )}
      <div className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
        {credits.map((c) => {
          const myRating = myRatingFor(watched, c);
          return (
            <PosterCard
              key={`${c.mediaType}-${c.id}`}
              item={c}
              myRating={myRating}
              sizes="(min-width: 1280px) 12vw, (min-width: 768px) 18vw, 30vw"
              subtitle={[c.year ?? "Upcoming", c.role].filter(Boolean).join(" · ")}
              className={watched && myRating === undefined ? "opacity-60 transition hover:opacity-100" : undefined}
            />
          );
        })}
      </div>
    </section>
  );
}

async function PersonContent({ params }: { params: PageProps<"/person/[id]">["params"] }) {
  const { id } = await params;
  const person = await loadPerson(id);
  const user = await getCurrentUser();
  const watched = user ? await getWatchedMap(user.id) : null;
  const photo = tmdbImage(person.profilePath, "h632");

  // Lead with what they're known for.
  const sections = [
    { key: "Directing", title: "Directed", credits: person.directing },
    { key: "Writing", title: "Written", credits: person.writing.filter((w) => !person.directing.some((d) => d.id === w.id && d.mediaType === w.mediaType)) },
    { key: "Acting", title: "Acting", credits: person.acting },
  ].sort((a, b) => Number(b.key === person.knownFor) - Number(a.key === person.knownFor));

  return (
    <div className="px-4 pt-28 sm:px-8 lg:px-12">
      <div className="mb-14 flex flex-col gap-8 sm:flex-row">
        <div className="relative aspect-[2/3] w-44 shrink-0 overflow-hidden rounded-xl bg-surface-2 shadow-2xl shadow-black sm:w-56">
          {photo && <Image src={photo} alt={person.name} fill preload sizes="224px" className="object-cover" />}
        </div>
        <div className="max-w-3xl">
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-accent">{person.knownFor}</p>
          <h1 className="mb-3 text-4xl font-black tracking-tight sm:text-5xl">{person.name}</h1>
          <p className="mb-5 text-sm text-muted">
            {[
              person.birthday && `Born ${formatDate(person.birthday)}`,
              person.placeOfBirth,
              person.deathday && `Died ${formatDate(person.deathday)}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {person.biography && (
            <details className="group">
              <summary className="cursor-pointer list-none">
                <p className="line-clamp-5 whitespace-pre-line leading-relaxed text-fg/85 group-open:line-clamp-none">{person.biography}</p>
                <span className="mt-2 inline-block text-sm text-muted hover:text-fg group-open:hidden">Read more</span>
              </summary>
            </details>
          )}
          {person.imdbId && (
            <a href={`https://www.imdb.com/name/${person.imdbId}/`} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1 text-xs text-muted hover:text-fg">
              IMDb <ExternalLink className="size-3" />
            </a>
          )}
        </div>
      </div>
      <div className="space-y-14">
        {sections.map((s) => (
          <Filmography key={s.key} title={s.title} credits={s.credits} watched={watched} />
        ))}
      </div>
    </div>
  );
}

export default function PersonPage(props: PageProps<"/person/[id]">) {
  if (!hasTmdbKey())
    return (
      <>
        <MissingKey />
        <DynamicMarker />
      </>
    );
  return (
    <>
      <Suspense fallback={<PageSkeleton />}>
        <PersonContent params={props.params} />
      </Suspense>
      <DynamicMarker />
    </>
  );
}
