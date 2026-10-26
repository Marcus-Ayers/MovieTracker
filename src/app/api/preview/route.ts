import type { NextRequest } from "next/server";
import { getExternalRatings } from "@/lib/ratings";
import { getTitleDetails, hasTmdbKey } from "@/lib/tmdb";

export type TitlePreview = {
  runtime: number | null;
  seasons: number | null;
  genres: string[];
  imdb: string | null;
  rottenTomatoes: string | null;
};

/** Hover-card details for one title: length, genres, IMDb and Rotten Tomatoes. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const type = params.get("type");
  const id = Number(params.get("id"));
  if ((type !== "movie" && type !== "tv") || !Number.isInteger(id) || id <= 0 || !hasTmdbKey()) {
    return Response.json({ error: "bad request" }, { status: 400 });
  }
  try {
    const details = await getTitleDetails(type, id);
    const ratings = await getExternalRatings(details.imdbId);
    const preview: TitlePreview = {
      runtime: details.runtime,
      seasons: details.numberOfSeasons,
      genres: details.genres.map((g) => g.name),
      imdb: ratings?.imdb ?? null,
      rottenTomatoes: ratings?.rottenTomatoes ?? null,
    };
    return Response.json(preview, { headers: { "Cache-Control": "private, max-age=86400" } });
  } catch {
    return Response.json({ error: "unavailable" }, { status: 502 });
  }
}
