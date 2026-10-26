"use server";

import { getCurrentUser } from "./auth";
import { loadDiscover, type DiscoverPage } from "./discover";
import { parseFilters } from "./discover-filters";
import type { MediaType } from "./format";
import { getWatchedMap } from "./library";

/** "Load more" on the Movies / TV pages. Re-reads the filters from the same query string the page used. */
export async function loadMoreDiscover(media: MediaType, query: string, page: number): Promise<DiscoverPage> {
  if (media !== "movie" && media !== "tv") throw new Error("bad media type");
  const filters = parseFilters(media, Object.fromEntries(new URLSearchParams(query)));
  const user = await getCurrentUser();
  const watched = user ? await getWatchedMap(user.id) : null;
  return loadDiscover(filters, Math.max(1, Math.min(500, Math.floor(page))), watched);
}
