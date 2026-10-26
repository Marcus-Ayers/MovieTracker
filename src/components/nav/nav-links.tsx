"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/format";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/movies", label: "Movies" },
  { href: "/tv", label: "TV Shows" },
  { href: "/explore", label: "Explore" },
  { href: "/library", label: "Library" },
  { href: "/diary", label: "Diary" },
  { href: "/stats", label: "Stats" },
  { href: "/watchlist", label: "Watchlist" },
];

function Links({ pathname }: { pathname: string | null }) {
  return (
    <nav className="no-scrollbar flex gap-5 overflow-x-auto text-sm">
      {LINKS.map((link) => {
        const active =
          pathname !== null &&
          (link.href === "/" ? pathname === "/" : pathname === link.href || pathname.startsWith(`${link.href}/`));
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "shrink-0 whitespace-nowrap transition-colors",
              active ? "font-semibold text-fg" : "text-muted hover:text-fg",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function NavLinks() {
  return <Links pathname={usePathname()} />;
}

/** Rendered while the pathname is unknown (dynamic routes during prerender). */
export function NavLinksFallback() {
  return <Links pathname={null} />;
}
