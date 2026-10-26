// Pure date/stat helpers. Dates are always YYYY-MM-DD strings to avoid time zone drift.
import { addDays, differenceInCalendarDays, endOfMonth, endOfWeek, format, parseISO, startOfMonth, startOfWeek } from "date-fns";

export const toDateString = (d: Date) => format(d, "yyyy-MM-dd");

export type DayEntry = {
  id: number;
  title: string;
  href: string;
  posterPath: string | null;
  rating: number | null;
  seasonNumber: number | null;
};

/** date → what you watched that day */
export type DayMap = Record<string, DayEntry[]>;

export function computeStreaks(dates: string[], today: string) {
  const days = [...new Set(dates)].sort();
  let longest = 0;
  let run = 0;
  for (let i = 0; i < days.length; i++) {
    run = i > 0 && differenceInCalendarDays(parseISO(days[i]), parseISO(days[i - 1])) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
  }
  let current = 0;
  const last = days.at(-1);
  // A streak is still "current" if you watched something today or yesterday.
  if (last && differenceInCalendarDays(parseISO(today), parseISO(last)) <= 1) {
    current = 1;
    for (let i = days.length - 1; i > 0; i--) {
      if (differenceInCalendarDays(parseISO(days[i]), parseISO(days[i - 1])) !== 1) break;
      current++;
    }
  }
  return { current, longest };
}

/** GitHub-style grid: columns are weeks (Sun→Sat). Days outside the range are null. */
export function weekColumns(start: string, end: string): (string | null)[][] {
  const first = parseISO(start);
  const last = parseISO(end);
  const columns: (string | null)[][] = [];
  let cursor = startOfWeek(first);
  const stop = endOfWeek(last);
  while (cursor <= stop) {
    const week: (string | null)[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(cursor >= first && cursor <= last ? toDateString(cursor) : null);
      cursor = addDays(cursor, 1);
    }
    columns.push(week);
  }
  return columns;
}

/** Calendar rows (Sun→Sat) for one month. */
export function monthWeeks(year: number, month: number): (string | null)[][] {
  const first = startOfMonth(new Date(year, month - 1, 1));
  const last = endOfMonth(first);
  const cols = weekColumns(toDateString(first), toDateString(last));
  return cols;
}

export function heatLevel(count: number) {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  if (count === 3) return 3;
  return 4;
}

export function countBy<T>(items: T[], key: (item: T) => string | number | null | undefined) {
  const counts = new Map<string | number, number>();
  for (const item of items) {
    const k = key(item);
    if (k === null || k === undefined || k === "") continue;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
