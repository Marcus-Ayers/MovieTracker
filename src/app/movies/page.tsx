import type { Metadata } from "next";
import { DiscoverView } from "@/components/discover/discover-view";

/**
 * /movies — every movie on TMDB with filters (the shared Movies/TV view is components/discover/discover-view.tsx).
 */

export const metadata: Metadata = { title: "Movies" };

export default function MoviesPage(props: PageProps<"/movies">) {
  return <DiscoverView media="movie" searchParams={props.searchParams} />;
}
