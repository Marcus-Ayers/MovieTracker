import type { NextRequest } from "next/server";
import { getPlot, type Plot } from "@/lib/plot";
import { getSeasonOverview, hasTmdbKey } from "@/lib/tmdb";

export type PlotResponse = { plot: Plot | null; seasonOverview: string | null };

/** The spoiler-filled plot (Wikipedia) for the rating queue, plus a TV season's own summary. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const type = params.get("type");
  const id = Number(params.get("id"));
  const season = params.get("season") === null ? null : Number(params.get("season"));
  if ((type !== "movie" && type !== "tv") || !Number.isInteger(id) || id <= 0 || (season !== null && !Number.isInteger(season)) || !hasTmdbKey()) {
    return Response.json({ error: "bad request" }, { status: 400 });
  }
  let failed = false;
  const [plot, seasonOverview] = await Promise.all([
    getPlot(type, id).catch(() => {
      failed = true;
      return null;
    }),
    type === "tv" && season !== null && season > 0 ? getSeasonOverview(id, season).catch(() => null) : null,
  ]);
  const body: PlotResponse = { plot, seasonOverview };
  // Don't let the browser hold on to an answer that was only empty because Wikipedia didn't respond.
  return Response.json(body, { headers: { "Cache-Control": failed ? "no-store" : "private, max-age=86400" } });
}
