import Link from "next/link";
import { Suspense } from "react";
import { HeaderShell } from "./header-shell";
import { NavLinks, NavLinksFallback } from "./nav-links";
import { NavSearch } from "./nav-search";
import { NavUser } from "./nav-user";

function Links() {
  return (
    <Suspense fallback={<NavLinksFallback />}>
      <NavLinks />
    </Suspense>
  );
}

export function SiteHeader() {
  return (
    <HeaderShell>
      <div className="flex h-16 items-center gap-6 px-4 sm:px-8 lg:px-12">
        <Link href="/" className="shrink-0 text-xl font-black tracking-tight text-accent">
          MOVIE<span className="text-fg">TRACKER</span>
        </Link>
        <div className="hidden min-w-0 flex-1 md:block">
          <Links />
        </div>
        <div className="ml-auto flex items-center gap-3 md:ml-0">
          <NavSearch />
          <Suspense fallback={<div className="size-8 rounded bg-surface-3" />}>
            <NavUser />
          </Suspense>
        </div>
      </div>
      <div className="px-4 pb-2 sm:px-8 md:hidden">
        <Links />
      </div>
    </HeaderShell>
  );
}
