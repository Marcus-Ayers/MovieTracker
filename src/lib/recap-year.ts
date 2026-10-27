import { notFound } from "next/navigation";

/** "2025" from the URL, or a 404 for anything that isn't a plausible year. */
export function parseRecapYear(value: string) {
  const year = Number(value);
  if (!/^\d{4}$/.test(value) || year < 1900 || year > 2100) notFound();
  return year;
}
