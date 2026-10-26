import type { NextRequest } from "next/server";
import { hasTmdbKey, searchKeywords, searchPeople } from "@/lib/tmdb";

/** Autocomplete for the Movies / TV sidebar: ?type=keyword|person&q=... */
export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get("type");
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2 || !hasTmdbKey()) return Response.json([]);
  try {
    if (type === "keyword") return Response.json(await searchKeywords(q));
    if (type === "person") return Response.json(await searchPeople(q));
    return Response.json([], { status: 400 });
  } catch {
    return Response.json([], { status: 502 });
  }
}
