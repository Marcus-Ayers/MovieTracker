"use client";

import { Shuffle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { cn } from "@/lib/format";

/** Rerolls every random section on the Explore page. */
export function ShuffleButton({ className, label = "Shuffle" }: { className?: string; label?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => router.push(`/explore?seed=${Math.floor(Math.random() * 1_000_000_000)}`, { scroll: false }))}
      className={cn(
        "inline-flex items-center gap-2 rounded px-5 py-2.5 font-semibold backdrop-blur transition disabled:opacity-60",
        className ?? "bg-white/15 hover:bg-white/25",
      )}
    >
      <Shuffle className={cn("size-5", pending && "animate-spin")} />
      {pending ? "Shuffling…" : label}
    </button>
  );
}
