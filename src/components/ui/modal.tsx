"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/format";

const WIDTHS = { sm: "sm:w-[min(94vw,30rem)]", md: "sm:w-[min(94vw,44rem)]", lg: "sm:w-[min(94vw,48rem)]", xl: "sm:w-[min(96vw,68rem)]" };

/**
 * A native <dialog> shown as a modal while `open` is true. On phones it's a sheet that slides up from the
 * bottom (unless `centered`, e.g. the trailer player); on wider screens it's a centered box.
 */
export function Modal({
  open,
  onClose,
  children,
  label,
  size = "md",
  centered = false,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  label: string;
  size?: keyof typeof WIDTHS;
  centered?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  // Set when this component closes the dialog itself (see below), so that isn't reported as the person closing it.
  const quietClose = useRef(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    // Next keeps the page you navigated away from alive in the background. A dialog left open there would
    // still block the whole screen, so close it when this page is hidden or unmounted (it reopens if you come
    // back). Quietly: the parent still thinks it's open, which is what it should find when you return.
    return () => {
      if (dialog.open) {
        quietClose.current = true;
        dialog.close();
      }
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={label}
      onClose={() => {
        if (quietClose.current) {
          quietClose.current = false;
          return;
        }
        onClose();
      }}
      onClick={(e) => {
        // Clicking the dimmed backdrop (the dialog element itself) closes it.
        if (e.target === e.currentTarget) onClose();
      }}
      className={cn(
        "max-h-[92dvh] max-w-none overflow-visible bg-transparent p-0 text-fg backdrop:bg-black/75 sm:m-auto",
        centered ? "m-auto w-[96vw]" : "mb-0 mt-auto w-full",
        WIDTHS[size],
      )}
    >
      {open && (
        <div
          className={cn(
            "relative max-h-[92dvh] overflow-y-auto border border-line bg-surface shadow-2xl shadow-black sm:rounded-xl sm:pb-0",
            centered ? "rounded-xl" : "animate-sheet-up rounded-t-2xl pb-[env(safe-area-inset-bottom)] sm:animate-none",
          )}
        >
          {!centered && <div aria-hidden className="mx-auto mt-2 h-1 w-10 rounded-full bg-fg/20 sm:hidden" />}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-3 z-10 grid size-9 place-items-center rounded-full bg-black/50 text-muted hover:text-fg sm:size-8"
          >
            <X className="size-5" />
          </button>
          {children}
        </div>
      )}
    </dialog>
  );
}
