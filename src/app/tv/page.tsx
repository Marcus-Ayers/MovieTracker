import type { Metadata } from "next";
import { Suspense } from "react";
import { BrowseContent, BrowseSkeleton } from "@/components/browse/browse-content";
import { MissingKey } from "@/components/missing-key";
import { hasTmdbKey } from "@/lib/tmdb";

export const metadata: Metadata = { title: "TV Shows" };

export default function TvPage() {
  if (!hasTmdbKey()) return <MissingKey />;
  return (
    <Suspense fallback={<BrowseSkeleton />}>
      <BrowseContent mode="tv" />
    </Suspense>
  );
}
