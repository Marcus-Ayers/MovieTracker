import { Suspense } from "react";
import { BrowseContent, BrowseSkeleton } from "@/components/browse/browse-content";
import { MissingKey } from "@/components/missing-key";
import { hasTmdbKey } from "@/lib/tmdb";

export default function HomePage() {
  if (!hasTmdbKey()) return <MissingKey />;
  return (
    <Suspense fallback={<BrowseSkeleton />}>
      <BrowseContent mode="all" />
    </Suspense>
  );
}
