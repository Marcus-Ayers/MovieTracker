"use client";

import { Eye, EyeOff } from "lucide-react";
import { useTransition } from "react";
import { setHideWatched } from "@/lib/actions";
import { cn } from "@/lib/format";

export function HideWatchedToggle({ hidden }: { hidden: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => setHideWatched(!hidden))}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium backdrop-blur transition",
        hidden ? "border-gold/60 bg-gold/10 text-gold" : "border-line bg-black/40 text-muted hover:text-fg",
        pending && "opacity-60",
      )}
    >
      {hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
      {hidden ? "Hiding what you've watched" : "Showing what you've watched"}
    </button>
  );
}
