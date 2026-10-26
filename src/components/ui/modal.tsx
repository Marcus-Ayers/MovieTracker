"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/format";

/** A native <dialog> shown as a modal while `open` is true. */
export function Modal({
  open,
  onClose,
  children,
  className,
  label,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  label: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={label}
      onClose={onClose}
      onClick={(e) => {
        // Clicking the dimmed backdrop (the dialog element itself) closes it.
        if (e.target === e.currentTarget) onClose();
      }}
      className={cn(
        "m-auto max-h-[92vh] w-[min(94vw,44rem)] overflow-visible rounded-xl bg-transparent p-0 text-fg backdrop:bg-black/75",
        className,
      )}
    >
      {open && (
        <div className="relative max-h-[92vh] overflow-y-auto rounded-xl border border-line bg-surface shadow-2xl shadow-black">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-3 z-10 grid size-8 place-items-center rounded-full bg-black/50 text-muted hover:text-fg"
          >
            <X className="size-5" />
          </button>
          {children}
        </div>
      )}
    </dialog>
  );
}
