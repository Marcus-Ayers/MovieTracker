import type { NextRequest } from "next/server";
import { hasTmdbKey, searchTitles } from "@/lib/tmdb";

/**
 * GET /api/search?q=… — quick search for the header box, the ＋ Log sheet and the "add a title" box on lists: the
 * top few titles and people (useQuickSearch calls this).
 */

export type QuickSearchResult = {
  items: { id: number; mediaType: "movie" | "tv"; title: string; year: number | null; posterPath: string | null }[];
  people: { id: number; name: string; profilePath: string | null; knownFor: string }[];
};

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const empty: QuickSearchResult = { items: [], people: [] };
  if (q.length < 2 || !hasTmdbKey()) return Response.json(empty);
  try {
    const { items, people } = await searchTitles(q);
    const result: QuickSearchResult = {
      items: items.slice(0, 7).map(({ id, mediaType, title, year, posterPath }) => ({ id, mediaType, title, year, posterPath })),
      people: people.filter((p) => p.profilePath).slice(0, 3),
    };
    return Response.json(result);
  } catch {
    return Response.json(empty, { status: 502 });
  }
}
