"use client";

import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/format";

/** Transparent over the hero, solid once you scroll — like Netflix. */
export function HeaderShell({ children }: { children: ReactNode }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-40 pt-[env(safe-area-inset-top)] transition-colors duration-300",
        scrolled ? "bg-bg/95 shadow-lg shadow-black/40 backdrop-blur" : "bg-gradient-to-b from-black/80 to-transparent",
      )}
    >
      {children}
    </header>
  );
}
