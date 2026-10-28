"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/format";

// Top-level pages. Anything deeper (a movie, a person, someone's profile…) gets a back button on phones,
// since a home-screen app has no browser back button.
const ROOTS = ["/", "/search", "/diary", "/library", "/stats", "/watchlist", "/lists", "/friends", "/settings", "/movies", "/tv", "/explore", "/rate", "/recap"];

/**
 * Phones: a back button on inner pages (a movie, a person, someone's profile), since an installed web app has no
 * browser back button.
 */
export function MobileBack() {
  const pathname = usePathname();
  const router = useRouter();
  if (ROOTS.includes(pathname)) return null;
  return (
    <button
      type="button"
      aria-label="Back"
      onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
      className="-ml-2 grid size-10 shrink-0 place-items-center rounded-full text-fg md:hidden"
    >
      <ChevronLeft className="size-7" />
    </button>
  );
}

const BROWSE = [
  { href: "/movies", label: "Movies" },
  { href: "/tv", label: "TV Shows" },
  { href: "/explore", label: "Explore" },
  { href: "/lists", label: "Lists" },
];

/** On phones, the browse pages get Netflix-style chips under the top bar instead of the full nav. */
export function BrowseChips() {
  const pathname = usePathname();
  if (pathname !== "/" && !BROWSE.some((b) => pathname === b.href)) return null;
  return (
    <nav aria-label="Browse" className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-2.5 md:hidden">
      {BROWSE.map((b) => (
        <Link
          key={b.href}
          href={b.href}
          className={cn(
            "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium",
            pathname === b.href ? "border-fg bg-fg text-bg" : "border-fg/30 bg-black/30 text-fg backdrop-blur",
          )}
        >
          {b.label}
        </Link>
      ))}
    </nav>
  );
}
