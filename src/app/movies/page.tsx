import type { Metadata } from "next";
import { DiscoverView } from "@/components/discover/discover-view";

export const metadata: Metadata = { title: "Movies" };

export default function MoviesPage(props: PageProps<"/movies">) {
  return <DiscoverView media="movie" searchParams={props.searchParams} />;
}
