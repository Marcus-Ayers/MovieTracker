"use client";

import { useClerk } from "@clerk/nextjs";
import { Download, Trash2 } from "lucide-react";
import { useState } from "react";
import { deleteAccount } from "@/lib/actions";

/** Settings → Delete account: removes everything here plus the Clerk sign-in, then signs out. */
export function DeleteAccountCard({ username }: { username: string }) {
  const clerk = useClerk();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const confirmed = typed.trim().toLowerCase() === username;

  const remove = async () => {
    setPending(true);
    setError(null);
    const result = await deleteAccount(typed).catch(() => ({ ok: false, error: undefined }));
    if (!result.ok) {
      setError(result.error ?? "Something went wrong. Try again.");
      setPending(false);
      return;
    }
    // The sign-in is gone: end the session in this browser, then start over from a full page load so nothing
    // from the deleted account stays cached. (Clerk's own sign-out navigation gets tangled up with this page
    // re-rendering as signed out, so don't wait on it for long.)
    await Promise.race([clerk.signOut().catch(() => {}), new Promise((resolve) => setTimeout(resolve, 3000))]);
    window.location.replace("/");
  };

  return (
    <section className="rounded-xl border border-accent/40 bg-surface p-6">
      <h2 className="mb-1 font-semibold">Delete account</h2>
      <p className="mb-4 text-sm text-muted">
        Permanently deletes your diary, ratings, reviews, watchlist, settings, Plex connection and your sign-in. This can&apos;t be undone.
      </p>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded border border-accent/60 px-4 py-2 text-sm text-accent hover:bg-accent/10"
        >
          <Trash2 className="size-4" /> Delete my account…
        </button>
      ) : (
        <div className="space-y-4 rounded-lg border border-line bg-bg p-4">
          <p className="text-sm">
            Want a copy first?{" "}
            <a href="/api/export" download className="inline-flex items-center gap-1 text-fg underline decoration-accent underline-offset-4">
              <Download className="size-3.5" /> Export everything
            </a>{" "}
            downloads a ZIP you can restore on another account.
          </p>
          <label className="block">
            <span className="mb-1.5 block text-sm text-muted">
              Type <span className="font-semibold text-fg">{username}</span> to confirm
            </span>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              className="h-11 w-full rounded-md border border-line bg-surface px-3 outline-none focus:border-accent"
            />
          </label>
          {error && <p className="text-sm text-accent">{error}</p>}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={remove}
              disabled={!confirmed || pending}
              className="inline-flex items-center gap-2 rounded bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-40"
            >
              <Trash2 className="size-4" /> {pending ? "Deleting…" : "Delete everything"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setTyped("");
                setError(null);
              }}
              className="rounded border border-line px-4 py-2 text-sm hover:border-fg/40"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
