import type { Metadata } from "next";
import { TitlePage } from "@/components/title/title-page";
import { getTvDetails, hasTmdbKey } from "@/lib/tmdb";

export async function generateMetadata(props: PageProps<"/tv/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  if (!hasTmdbKey()) return { title: "TV Show" };
  try {
    const d = await getTvDetails(Number(id));
    return { title: d.year ? `${d.title} (${d.year})` : d.title, description: d.overview };
  } catch {
    return { title: "TV Show" };
  }
}

export default function TvShowPage(props: PageProps<"/tv/[id]">) {
  return <TitlePage mediaType="tv" params={props.params} />;
}
