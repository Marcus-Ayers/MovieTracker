import type { Metadata } from "next";
import { DiscoverView } from "@/components/discover/discover-view";

/**
 * /tv — every TV show on TMDB with filters (same view as /movies).
 */

export const metadata: Metadata = { title: "TV Shows" };

export default function TvPage(props: PageProps<"/tv">) {
  return <DiscoverView media="tv" searchParams={props.searchParams} />;
}
