"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { RatePromptResponse } from "@/app/api/rate-prompt/route";
import { dismissRatePrompt } from "@/lib/actions";
import { plural } from "@/lib/format";
import { Modal } from "../ui/modal";
import { RateQueue } from "./rate-queue";

// Pages where a pop-up would be in the way.
const QUIET = ["/rate", "/sign-in", "/sign-up", "/account", "/settings", "/plex"];

/**
 * Once per visit: asks the server for Plex watches that came in since you last saw this, and pops them up
 * to rate. Closing it (or rating everything) means those won't pop up again; they stay in /rate.
 */
export function RatePrompt() {
  const pathname = usePathname();
  const [prompt, setPrompt] = useState<RatePromptResponse | null>(null);
  const [open, setOpen] = useState(false);
  const [quiet] = useState(() => QUIET.some((p) => pathname === p || pathname.startsWith(`${p}/`)));

  useEffect(() => {
    if (quiet) return;
    let live = true;
    fetch("/api/rate-prompt", { method: "POST" })
      .then((res) => (res.ok ? (res.json() as Promise<RatePromptResponse>) : null))
      .then((data) => {
        if (live && data?.items.length) {
          setPrompt(data);
          setOpen(true);
        }
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [quiet]);

  if (!prompt) return null;
  const close = () => {
    setOpen(false);
    void dismissRatePrompt(prompt.checkedAt);
  };
  const extra = prompt.total - prompt.items.length;

  return (
    <Modal open={open} onClose={close} label="Rate what you just watched" className="w-[min(94vw,48rem)]">
      <div className="p-5 sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">New on Plex</p>
        <h2 className="mb-5 mt-1 pr-8 text-xl font-bold sm:text-2xl">
          You watched {plural(prompt.total, "new thing", "new things")}. How was {prompt.total === 1 ? "it" : "everything"}?
        </h2>
        <RateQueue initialItems={prompt.items} initialTotal={prompt.items.length} compact onDone={close} />
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-sm">
          <button type="button" onClick={close} className="rounded border border-line px-4 py-2 hover:border-fg/40">
            Later
          </button>
          <p className="text-dim">
            {extra > 0 && (
              <>
                <Link href="/rate" onClick={close} className="text-muted underline hover:text-fg">
                  {plural(extra, "more")} in your rating queue
                </Link>
                {" · "}
              </>
            )}
            Turn these pop-ups off in{" "}
            <Link href="/settings" onClick={close} className="text-muted underline hover:text-fg">
              Settings
            </Link>
          </p>
        </div>
      </div>
    </Modal>
  );
}
