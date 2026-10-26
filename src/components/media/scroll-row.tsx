"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/format";

/** A Netflix-style horizontal row with paging arrows. Cards are passed in as children. */
export function ScrollRow({
  title,
  href,
  children,
  className,
}: {
  title: ReactNode;
  href?: string;
  children: ReactNode;
  className?: string;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  const update = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 8 });
  }, []);

  useEffect(() => {
    update();
    const el = scroller.current;
    if (!el) return;
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [update]);

  const page = (dir: 1 | -1) => {
    const el = scroller.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };

  return (
    <section className={cn("group/row relative", className)}>
      <div className="mb-3 flex items-baseline gap-3 px-4 sm:px-8 lg:px-12">
        <h2 className="text-lg font-semibold tracking-tight sm:text-xl">{title}</h2>
        {href && (
          <Link
            href={href}
            className="text-xs font-medium text-muted opacity-0 transition hover:text-fg group-hover/row:opacity-100"
          >
            See all ›
          </Link>
        )}
      </div>
      <div className="relative">
        <div
          ref={scroller}
          onScroll={update}
          className="no-scrollbar flex snap-x snap-mandatory scroll-px-4 gap-2 overflow-x-auto px-4 pb-4 pt-1 sm:scroll-px-8 sm:gap-3 sm:px-8 lg:scroll-px-12 lg:px-12"
        >
          {children}
        </div>
        <button
          type="button"
          aria-label="Scroll left"
          onClick={() => page(-1)}
          className={cn(
            "absolute inset-y-0 left-0 z-10 hidden w-12 items-center justify-center bg-gradient-to-r from-bg/90 to-transparent opacity-0 transition hover:from-bg group-hover/row:opacity-100 sm:flex",
            edges.start && "pointer-events-none !opacity-0",
          )}
        >
          <ChevronLeft className="size-8" />
        </button>
        <button
          type="button"
          aria-label="Scroll right"
          onClick={() => page(1)}
          className={cn(
            "absolute inset-y-0 right-0 z-10 hidden w-12 items-center justify-center bg-gradient-to-l from-bg/90 to-transparent opacity-0 transition hover:from-bg group-hover/row:opacity-100 sm:flex",
            edges.end && "pointer-events-none !opacity-0",
          )}
        >
          <ChevronRight className="size-8" />
        </button>
      </div>
    </section>
  );
}
