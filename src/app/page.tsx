import { Suspense } from "react";
import { BrowseContent, BrowseSkeleton } from "@/components/browse/browse-content";
import { MissingKey } from "@/components/missing-key";
import { hasTmdbKey } from "@/lib/tmdb";

/**
 * / — the home page: the hero carousel and the browse rows (built in components/browse/browse-content.tsx).
 */

export default function HomePage() {
  if (!hasTmdbKey()) return <MissingKey />;
  return (
    <Suspense fallback={<BrowseSkeleton />}>
      <BrowseContent />
    </Suspense>
  );
}
