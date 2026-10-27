import "server-only";
import { cacheLife } from "next/cache";
import type { MediaType } from "./format";
import { getWikidataId } from "./tmdb";

/**
 * Full plot summaries (spoilers included) from English Wikipedia, for jogging your memory before you rate
 * something. TMDB → Wikidata item → Wikipedia article → its "Plot" section. Wikipedia text is CC BY-SA, so
 * the page that shows it links back to the article.
 */

export type Plot = { paragraphs: string[]; article: string; url: string };

// Wikimedia asks API clients to identify themselves.
const USER_AGENT = `MovieTracker/1.0 (personal movie diary${process.env.VERCEL_PROJECT_PRODUCTION_URL ? `; https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : ""})`;

// The section names film and TV articles use for the story, best first.
const SECTIONS = ["plot", "plot summary", "synopsis", "story", "storyline", "summary", "premise"];
const MAX_PARAGRAPHS = 14;

async function wiki<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, accept: "application/json" } });
  if (!res.ok) throw new Error(`Wikimedia request failed (${res.status})`);
  return (await res.json()) as T;
}

/** Wikidata also records TMDB ids (P4947 movies, P4983 shows), for titles whose TMDB page lacks a Wikidata link. */
async function wikidataByTmdbId(mediaType: MediaType, tmdbId: number) {
  const property = mediaType === "movie" ? "P4947" : "P4983";
  const data = await wiki<{ query?: { search: { title: string }[] } }>(
    `https://www.wikidata.org/w/api.php?action=query&list=search&srsearch=haswbstatement:${property}=${tmdbId}&srlimit=1&format=json`,
  );
  return data.query?.search[0]?.title ?? null;
}

async function englishArticle(qid: string) {
  const data = await wiki<{ entities?: Record<string, { sitelinks?: { enwiki?: { title: string; url?: string } } }> }>(
    `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qid}&props=sitelinks/urls&sitefilter=enwiki&format=json`,
  );
  return data.entities?.[qid]?.sitelinks?.enwiki ?? null;
}

/** The text under the article's plot heading, as paragraphs. */
export function plotSection(extract: string): string[] | null {
  // ["intro", "Plot", "…", "Cast", "…", …] — level-2 headings only ("== Plot ==", not "=== Part one ===").
  const parts = extract.split(/^==\s*([^=].*?)\s*==\s*$/m);
  const sections = new Map<string, string>();
  for (let i = 1; i < parts.length; i += 2) {
    const name = parts[i].toLowerCase();
    if (!sections.has(name)) sections.set(name, parts[i + 1] ?? "");
  }
  const body = SECTIONS.map((name) => sections.get(name)).find((text) => text?.trim());
  if (!body) return null;
  const paragraphs = body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("="));
  return paragraphs.length ? paragraphs.slice(0, MAX_PARAGRAPHS) : null;
}

/**
 * The Wikipedia plot for a movie or show, or null when there's no article or it has no plot section.
 * Network failures throw (so they aren't cached).
 */
export async function getPlot(mediaType: MediaType, tmdbId: number): Promise<Plot | null> {
  "use cache";
  cacheLife("weeks");
  const qid = (await getWikidataId(mediaType, tmdbId)) ?? (await wikidataByTmdbId(mediaType, tmdbId));
  if (!qid) return null;
  const article = await englishArticle(qid);
  if (!article) return null;
  const data = await wiki<{ query?: { pages: { extract?: string; missing?: boolean }[] } }>(
    `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&exsectionformat=wiki&redirects=1&format=json&formatversion=2&titles=${encodeURIComponent(article.title)}`,
  );
  const paragraphs = plotSection(data.query?.pages[0]?.extract ?? "");
  if (!paragraphs) return null;
  return {
    paragraphs,
    article: article.title,
    url: article.url ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(article.title.replaceAll(" ", "_"))}`,
  };
}
