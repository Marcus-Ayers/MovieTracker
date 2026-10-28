"use client";

import { Clapperboard, Share, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";

const DISMISSED = "install-hint-dismissed";

/** iPhone/iPad Safari that isn't already running as the installed app, and hasn't dismissed this. */
function shouldShow() {
  try {
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const installed = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    return ios && !installed && localStorage.getItem(DISMISSED) !== "1";
  } catch {
    return false;
  }
}

const noSubscribe = () => () => {};

/** iPhones never offer to install a web app, so the home page explains how, once. */
export function InstallHint() {
  const pathname = usePathname();
  const eligible = useSyncExternalStore(noSubscribe, shouldShow, () => false);
  const [dismissed, setDismissed] = useState(false);
  if (!eligible || dismissed || pathname !== "/") return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED, "1");
    } catch {
      // Private browsing: it'll just show again next time.
    }
    setDismissed(true);
  };

  return (
    <div className="fixed inset-x-3 bottom-[calc(var(--tabbar-h)+0.75rem)] z-30 flex items-start gap-3 rounded-2xl border border-line bg-surface-2/95 p-4 shadow-2xl shadow-black backdrop-blur md:hidden">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-accent-hover to-accent text-white">
        <Clapperboard className="size-6" />
      </span>
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold">Put MovieTracker on your Home Screen</p>
        <p className="mt-0.5 text-muted">
          Tap <Share className="inline size-4 align-text-bottom" /> Share (under ••• on newer iPhones), then <span className="text-fg">Add to Home Screen</span>.
        </p>
      </div>
      <button type="button" onClick={dismiss} aria-label="Dismiss" className="-mr-1 -mt-1 grid size-8 place-items-center rounded-full text-muted">
        <X className="size-5" />
      </button>
    </div>
  );
}
