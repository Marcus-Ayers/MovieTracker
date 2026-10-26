import { TriangleAlert } from "lucide-react";
import { cn } from "@/lib/format";

/** Renders a saved review. HTML is sanitized when it's saved (see cleanReview in actions.ts). */
export function ReviewBody({ html, spoilers, className }: { html: string; spoilers: boolean; className?: string }) {
  const body = <div className={cn("review-content text-[15px] text-fg/90", className)} dangerouslySetInnerHTML={{ __html: html }} />;
  if (!spoilers) return body;
  return (
    <details className="group">
      <summary className="inline-flex cursor-pointer select-none items-center gap-2 rounded bg-surface-3 px-3 py-1.5 text-sm text-muted hover:text-fg group-open:mb-3">
        <TriangleAlert className="size-4 text-accent" />
        <span className="group-open:hidden">Contains spoilers — click to read</span>
        <span className="hidden group-open:inline">Hide spoilers</span>
      </summary>
      {body}
    </details>
  );
}
