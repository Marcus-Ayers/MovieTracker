"use client";

import { Link2, RefreshCw, Unplug } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { disconnectPlex, finishPlexLink, setPlexAccount, startPlexLink, syncPlexNow } from "@/lib/plex-actions";
import { cn } from "@/lib/format";

export type PlexCardData =
  | { connected: false }
  | {
      connected: true;
      serverName: string;
      accountId: number | null;
      accounts: { id: number; name: string }[];
      lastSync: string | null;
      summary: string | null;
      reachable: boolean;
    };

const timeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Settings → Plex: connect, choose whose watch history is yours, sync now, import the full history, or disconnect. */
export function PlexCard({ data }: { data: PlexCardData }) {
  const router = useRouter();
  const [linking, setLinking] = useState<"idle" | "waiting" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const polling = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (polling.current) clearInterval(polling.current);
  }, []);

  const connect = async () => {
    setError(null);
    // Open the window right away (inside the click) so popup blockers allow it.
    const popup = window.open("about:blank", "plex-sign-in", "width=620,height=760");
    try {
      const { url } = await startPlexLink();
      if (popup) popup.location.href = url;
      else window.location.href = url;
    } catch {
      popup?.close();
      setError("Couldn't reach Plex. Try again in a moment.");
      return;
    }
    setLinking("waiting");
    const startedAt = Date.now();
    polling.current = setInterval(async () => {
      const result = await finishPlexLink(timeZone()).catch(() => null);
      if (result?.status === "waiting" && Date.now() - startedAt < 5 * 60_000) return;
      if (polling.current) clearInterval(polling.current);
      if (result?.status === "connected") {
        setLinking("idle");
        router.refresh();
      } else {
        setLinking("error");
        setError(result?.status === "error" ? result.message : "Plex sign-in timed out. Try again.");
      }
    }, 2000);
  };

  return (
    <section className="rounded-xl border border-line bg-surface p-6">
      <div className="mb-1 flex items-center gap-2">
        <span className="rounded bg-[#e5a00d] px-1.5 py-0.5 text-[11px] font-black text-black">PLEX</span>
        <h2 className="font-semibold">Plex</h2>
      </div>

      {!data.connected ? (
        <>
          <p className="mb-5 text-sm text-muted">
            Connect your Plex account to bring in everything you&apos;ve watched there, and keep logging new plays automatically. You
            sign in on Plex&apos;s own page; this site never sees your password.
          </p>
          <button
            type="button"
            onClick={() => void connect()}
            disabled={linking === "waiting"}
            className="inline-flex items-center gap-2 rounded bg-[#e5a00d] px-4 py-2 text-sm font-semibold text-black hover:bg-[#f0b429] disabled:opacity-60"
          >
            <Link2 className="size-4" />
            {linking === "waiting" ? "Waiting for you to sign in on Plex…" : "Connect Plex"}
          </button>
          {error && <p className="mt-3 text-sm text-accent">{error}</p>}
        </>
      ) : (
        <>
          <p className="mb-5 text-sm text-muted">
            Connected to <span className="font-medium text-fg">{data.serverName}</span>.
            {!data.reachable && <span className="text-accent"> The server isn&apos;t answering right now — is it running?</span>}
          </p>
          <div className="mb-5 grid gap-4 text-sm sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-muted">Whose plays count</span>
              <select
                value={data.accountId ?? ""}
                disabled={!data.accounts.length || pending}
                onChange={(e) => startTransition(() => setPlexAccount(Number(e.target.value)))}
                className="h-9 w-full cursor-pointer rounded-md border border-line bg-bg px-3 outline-none focus:border-fg/40"
              >
                {data.accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                    {a.id === 1 ? " (server owner)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <div>
              <p className="mb-1.5 text-muted">Last sync</p>
              <p>{data.lastSync ? `${data.lastSync} · ${data.summary}` : "Not synced yet"}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/settings/import?source=plex" className="inline-flex items-center gap-2 rounded bg-[#e5a00d] px-4 py-2 text-sm font-semibold text-black hover:bg-[#f0b429]">
              Import Plex history
            </Link>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  setMessage(null);
                  setMessage((await syncPlexNow()).message);
                })
              }
              className="inline-flex items-center gap-2 rounded border border-line px-4 py-2 text-sm hover:border-fg/40 disabled:opacity-60"
            >
              <RefreshCw className={cn("size-4", pending && "animate-spin")} /> Sync new plays now
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (window.confirm("Disconnect Plex? Your diary entries stay; new plays just won't sync.")) startTransition(() => disconnectPlex());
              }}
              className="inline-flex items-center gap-2 px-2 py-2 text-sm text-muted hover:text-accent"
            >
              <Unplug className="size-4" /> Disconnect
            </button>
          </div>
          {message && <p className="mt-3 text-sm text-muted">{message}</p>}
          <p className="mt-4 text-xs text-dim">
            Start with <span className="text-muted">Import Plex history</span> to review everything once. After that, new plays sync on
            their own every night (once the site is deployed), or whenever you hit Sync.
          </p>
        </>
      )}
    </section>
  );
}
