import type { Metadata } from "next";
import { TitlePage } from "@/components/title/title-page";
import { getMovieDetails, hasTmdbKey } from "@/lib/tmdb";

/**
 * /movie/[id] — a movie's page (the layout is components/title/title-page.tsx, shared with TV).
 */

export async function generateMetadata(props: PageProps<"/movie/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  if (!hasTmdbKey()) return { title: "Movie" };
  try {
    const d = await getMovieDetails(Number(id));
    return { title: d.year ? `${d.title} (${d.year})` : d.title, description: d.overview };
  } catch {
    return { title: "Movie" };
  }
}

export default function MoviePage(props: PageProps<"/movie/[id]">) {
  return <TitlePage mediaType="movie" params={props.params} />;
}
