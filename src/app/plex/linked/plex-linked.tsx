"use client";

import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { finishPlexLink } from "@/lib/plex-actions";

/**
 * The page Plex sends you back to after you approve the connection: finishes linking (finishPlexLink) and then
 * returns you to Settings.
 */
export function PlexLinked() {
  const router = useRouter();
  const [message, setMessage] = useState("Finishing up…");

  useEffect(() => {
    // Opened as a popup: the Settings tab is already finishing the link, so just close.
    if (window.opener) {
      window.close();
      return;
    }
    // Opened in the same tab (popup was blocked): finish here, then go back to Settings.
    let cancelled = false;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const poll = async (tries: number) => {
      const result = await finishPlexLink(tz).catch(() => null);
      if (cancelled) return;
      if (result?.status === "connected") router.replace("/settings");
      else if (result?.status === "waiting" && tries < 30) setTimeout(() => void poll(tries + 1), 2000);
      else setMessage(result?.status === "error" ? result.message : "Something went wrong connecting Plex.");
    };
    void poll(0);
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="mx-auto max-w-md px-4 pb-10 pt-36 text-center">
      <CheckCircle2 className="mx-auto mb-4 size-10 text-[#e5a00d]" />
      <h1 className="mb-2 text-2xl font-bold">Plex sign-in done</h1>
      <p className="mb-6 text-muted">{message} You can close this window.</p>
      <Link href="/settings" className="text-sm text-muted underline-offset-4 hover:text-fg hover:underline">
        Back to Settings
      </Link>
    </div>
  );
}
