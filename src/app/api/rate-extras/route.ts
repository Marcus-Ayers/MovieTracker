import type { NextRequest } from "next/server";
import { getPlot, type Plot } from "@/lib/plot";
import { getExternalRatings, type ExternalRatings } from "@/lib/ratings";
import { getSeasonOverview, hasTmdbKey } from "@/lib/tmdb";

export type RateExtras = { plot: Plot | null; seasonOverview: string | null; ratings: ExternalRatings | null };

/**
 * What a rating-queue card loads after it appears: the spoiler-filled plot (Wikipedia), a TV season's own
 * summary, and IMDb / Rotten Tomatoes / Metacritic scores.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const type = params.get("type");
  const id = Number(params.get("id"));
  const season = params.get("season") === null ? null : Number(params.get("season"));
  const imdb = params.get("imdb");
  if (
    (type !== "movie" && type !== "tv") ||
    !Number.isInteger(id) ||
    id <= 0 ||
    (season !== null && !Number.isInteger(season)) ||
    (imdb !== null && !/^tt\d{5,10}$/.test(imdb)) ||
    !hasTmdbKey()
  ) {
    return Response.json({ error: "bad request" }, { status: 400 });
  }
  let failed = false;
  const [plot, seasonOverview, ratings] = await Promise.all([
    getPlot(type, id).catch(() => {
      failed = true;
      return null;
    }),
    type === "tv" && season !== null && season > 0 ? getSeasonOverview(id, season).catch(() => null) : null,
    getExternalRatings(imdb).catch(() => null),
  ]);
  const body: RateExtras = { plot, seasonOverview, ratings };
  // Don't let the browser hold on to an answer that was only empty because Wikipedia didn't respond.
  return Response.json(body, { headers: { "Cache-Control": failed ? "no-store" : "private, max-age=86400" } });
}
