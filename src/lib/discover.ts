import "server-only";
import type { DiscoverFilters } from "./discover-filters";
import { toTmdbParams } from "./discover-filters";
import { discover, type MediaItem } from "./tmdb";

/**
 * The Movies and TV pages' results: runs the page's filters against TMDB's Discover endpoint and marks what you've
 * already seen (optionally hiding it).
 */

export type DiscoverItem = MediaItem & { myRating?: number | null };
export type DiscoverPage = { items: DiscoverItem[]; nextPage: number | null; totalResults: number };

const PAGE_SIZE = 20;
const MAX_PAGES = 500; // TMDB's limit

/**
 * One "page" of results starting at TMDB page `startPage`. With "hide what I've seen" on, keeps pulling
 * TMDB pages (up to 5) until it has a full page of unseen titles.
 */
export async function loadDiscover(
  f: DiscoverFilters,
  startPage: number,
  watched: Record<string, number | null> | null,
): Promise<DiscoverPage> {
  const params = toTmdbParams(f);
  const items: DiscoverItem[] = [];
  let page = startPage;
  let totalPages = 1;
  let totalResults = 0;
  do {
    const res = await discover(f.media, params, page);
    totalPages = Math.min(res.totalPages, MAX_PAGES);
    totalResults = res.totalResults;
    for (const item of res.items) {
      const key = `${item.mediaType}-${item.id}`;
      const seen = watched !== null && key in watched;
      if (f.hideSeen && seen) continue;
      items.push(seen ? { ...item, myRating: watched![key] } : item);
    }
    page++;
  } while (f.hideSeen && items.length < PAGE_SIZE && page <= totalPages && page - startPage < 5);
  return { items, nextPage: page <= totalPages ? page : null, totalResults };
}
