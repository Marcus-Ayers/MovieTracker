"use client";

import { Check, Clock, UserPlus } from "lucide-react";
import { useState, useTransition } from "react";
import { acceptFriendRequest, removeConnection, sendFriendRequest, type FriendActionResult } from "@/lib/friend-actions";
import { cn } from "@/lib/format";
import type { Relation } from "@/lib/friends";

const base = "inline-flex items-center gap-1.5 rounded-full font-semibold transition disabled:opacity-60";
const sizes = { sm: "h-8 px-3 text-xs", md: "h-9 px-4 text-sm" };
const solid = "bg-accent text-white hover:bg-accent-hover";
const outline = "border border-line text-fg hover:border-fg/40";
const danger = "border border-accent/60 text-accent hover:bg-accent/10";

/** Add friend → Requested → Friends, plus Accept/Decline for requests you've received. */
export function FriendButton({ username, relation, size = "md" }: { username: string; relation: Relation; size?: "sm" | "md" }) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = (action: (username: string) => Promise<FriendActionResult>) =>
    startTransition(async () => {
      setError(null);
      const result = await action(username);
      if (!result.ok) setError(result.error ?? "Something went wrong. Try again.");
      setConfirming(false);
    });
  const cls = (tone: string) => cn(base, sizes[size], tone);

  let buttons;
  if (relation === "none") {
    buttons = (
      <button type="button" disabled={pending} onClick={() => run(sendFriendRequest)} className={cls(solid)}>
        <UserPlus className="size-4" /> Add friend
      </button>
    );
  } else if (relation === "incoming") {
    buttons = (
      <>
        <button type="button" disabled={pending} onClick={() => run(acceptFriendRequest)} className={cls(solid)}>
          <Check className="size-4" /> Accept
        </button>
        <button type="button" disabled={pending} onClick={() => run(removeConnection)} className={cls(outline)}>
          Decline
        </button>
      </>
    );
  } else if (confirming) {
    buttons = (
      <>
        <button type="button" disabled={pending} onClick={() => run(removeConnection)} className={cls(danger)}>
          {relation === "friends" ? "Unfriend" : "Cancel request"}
        </button>
        <button type="button" disabled={pending} onClick={() => setConfirming(false)} className={cls(outline)}>
          Keep
        </button>
      </>
    );
  } else {
    buttons = (
      <button type="button" disabled={pending} onClick={() => setConfirming(true)} className={cls(outline)}>
        {relation === "friends" ? <Check className="size-4 text-accent" /> : <Clock className="size-4 text-muted" />}
        {relation === "friends" ? "Friends" : "Requested"}
      </button>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {buttons}
      {error && <span className="text-xs text-accent">{error}</span>}
    </span>
  );
}
