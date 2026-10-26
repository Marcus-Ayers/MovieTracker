import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getTitleState, historyFor, type LogHistory } from "@/lib/library";
import { getTvDetails } from "@/lib/tmdb";

export type MyTitle =
  | { loggedIn: false }
  | { loggedIn: true; onWatchlist: boolean; history: LogHistory; seasons: { number: number; name: string }[] };

/** Your state for one title (watchlist, past viewings), for the poster hover buttons. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const type = params.get("type");
  const id = Number(params.get("id"));
  if ((type !== "movie" && type !== "tv") || !Number.isInteger(id) || id <= 0) {
    return Response.json({ error: "bad request" }, { status: 400 });
  }
  const noStore = { headers: { "Cache-Control": "no-store" } };
  const user = await getCurrentUser();
  if (!user) return Response.json({ loggedIn: false } satisfies MyTitle, noStore);

  const state = await getTitleState(user.id, id, type);
  const seasons = type === "tv" ? ((await getTvDetails(id).catch(() => null))?.seasons ?? []).map((s) => ({ number: s.number, name: s.name })) : [];
  const body: MyTitle = { loggedIn: true, onWatchlist: state.onWatchlist, history: historyFor(state.entry), seasons };
  return Response.json(body, noStore);
}
