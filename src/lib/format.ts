// Small helpers that are safe to use from both server and client components.

export type MediaType = "movie" | "tv";

export const MEDIA_LABEL: Record<MediaType, string> = { movie: "Movie", tv: "TV Show" };

type ImageSize = "w45" | "w92" | "w154" | "w185" | "w300" | "w342" | "w500" | "w780" | "w1280" | "h632" | "original";

/** Full URL for a TMDB image path at a given size (null when there's no image). */
export function tmdbImage(path: string | null | undefined, size: ImageSize) {
  return path ? `https://image.tmdb.org/t/p/${size}${path}` : null;
}

/** Link to a title's page: /movie/949 or /tv/1396. */
export function titleHref(mediaType: MediaType, id: number) {
  return `/${mediaType}/${id}`;
}

/** Minutes as "2h 30m" (null when unknown). */
export function formatRuntime(minutes: number | null | undefined) {
  if (!minutes) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h${m ? ` ${m}m` : ""}` : `${m}m`;
}

/** Dollars, compact: "$187.4M". */
export function formatMoney(amount: number | null | undefined) {
  if (!amount) return null;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(amount);
}

const DATE_FMT = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

/** Formats a YYYY-MM-DD date without shifting it across time zones. */
export function formatDate(date: string | null | undefined) {
  if (!date) return null;
  return DATE_FMT.format(new Date(`${date}T00:00:00Z`));
}

const LANGUAGES = new Intl.DisplayNames(["en"], { type: "language" });

/** A language code as its English name: "ko" → "Korean". */
export function languageName(code: string | null | undefined) {
  if (!code) return null;
  try {
    return LANGUAGES.of(code) ?? code;
  } catch {
    return code;
  }
}

/** "Season 2", "Specials" (season 0), or "Entire series" (no season). */
export function seasonLabel(seasonNumber: number | null) {
  if (seasonNumber === null) return "Entire series";
  if (seasonNumber === 0) return "Specials";
  return `Season ${seasonNumber}`;
}

/** Joins class names, skipping empty ones: cn("a", false && "b", "c") → "a c". */
export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

/** "1 film", "3 films" (pass the plural form when it isn't just + s). */
export function plural(count: number, word: string, pluralWord = `${word}s`) {
  return `${count.toLocaleString()} ${count === 1 ? word : pluralWord}`;
}
