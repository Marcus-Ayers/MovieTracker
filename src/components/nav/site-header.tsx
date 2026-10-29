import Link from "next/link";
import { Suspense } from "react";
import { SeatRow } from "../brand-mark";
import { HeaderShell } from "./header-shell";
import { BrowseChips, MobileBack } from "./mobile-header";
import { NavLinks, NavLinksFallback } from "./nav-links";
import { NavSearch } from "./nav-search";
import { NavUser } from "./nav-user";

/**
 * The fixed header on every page. Desktop: logo, nav links, search and your account. Phones: a back button on
 * inner pages, the logo, your account, and browse chips on browse pages; everything else is in the bottom tab bar
 * (tab-bar.tsx).
 */

export function SiteHeader() {
  return (
    <HeaderShell>
      <div className="flex h-14 items-center gap-6 px-4 sm:px-8 md:h-16 lg:px-12">
        <div className="flex shrink-0 items-center">
          <Suspense>
            <MobileBack />
          </Suspense>
          <Link href="/" aria-label="Row Six home" className="flex items-center gap-2.5 text-xl font-black tracking-tight">
            <SeatRow className="h-[18px] w-auto" />
            ROW SIX
          </Link>
        </div>
        <div className="hidden min-w-0 flex-1 md:block">
          <Suspense fallback={<NavLinksFallback />}>
            <NavLinks />
          </Suspense>
        </div>
        <div className="ml-auto flex items-center gap-3 md:ml-0">
          {/* Phones search from the tab bar. */}
          <div className="hidden md:block">
            <NavSearch />
          </div>
          <Suspense fallback={<div className="size-8 rounded bg-surface-3" />}>
            <NavUser />
          </Suspense>
        </div>
      </div>
      <Suspense>
        <BrowseChips />
      </Suspense>
    </HeaderShell>
  );
}
