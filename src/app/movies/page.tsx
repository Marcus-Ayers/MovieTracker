import type { Metadata } from "next";
import { Suspense } from "react";
import { BrowseContent, BrowseSkeleton } from "@/components/browse/browse-content";
import { MissingKey } from "@/components/missing-key";
import { hasTmdbKey } from "@/lib/tmdb";

export const metadata: Metadata = { title: "Movies" };

export default function MoviesPage() {
  if (!hasTmdbKey()) return <MissingKey />;
  return (
    <Suspense fallback={<BrowseSkeleton />}>
      <BrowseContent mode="movie" />
    </Suspense>
  );
}
