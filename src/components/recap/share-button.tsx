"use client";

import { Check, Share2 } from "lucide-react";
import { useState } from "react";

/** Shares the public recap link: the share sheet on phones and tablets, copy-to-clipboard everywhere else. */
export function ShareButton({ path, title, note }: { path: string; title: string; note?: string }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = `${window.location.origin}${path}`;
    if (navigator.share && window.matchMedia("(pointer: coarse)").matches) {
      await navigator.share({ title, url }).catch(() => {});
      return;
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={share}
        className="inline-flex items-center gap-2 rounded bg-fg px-5 py-2.5 font-semibold text-bg transition hover:bg-fg/85"
      >
        {copied ? <Check className="size-4" /> : <Share2 className="size-4" />}
        {copied ? "Link copied" : "Share"}
      </button>
      {note && <p className="max-w-sm text-xs text-dim">{note}</p>}
    </div>
  );
}
