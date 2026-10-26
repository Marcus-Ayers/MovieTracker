import { connection } from "next/server";
import { Suspense } from "react";

async function Connection() {
  await connection();
  return null;
}

/**
 * Renders nothing. Tells Next.js this page is intentionally dynamic, so `generateMetadata`
 * may read `params` without blocking prefetching of the rest of the page.
 */
export function DynamicMarker() {
  return (
    <Suspense>
      <Connection />
    </Suspense>
  );
}
