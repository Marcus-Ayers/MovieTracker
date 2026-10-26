import type { Metadata } from "next";
import { DiscoverView } from "@/components/discover/discover-view";

export const metadata: Metadata = { title: "TV Shows" };

export default function TvPage(props: PageProps<"/tv">) {
  return <DiscoverView media="tv" searchParams={props.searchParams} />;
}
