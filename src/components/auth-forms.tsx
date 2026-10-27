"use client";

import { useActionState } from "react";
import { linkAccount, type ActionState } from "@/lib/actions";
import { submitTo } from "@/lib/forms";

const inputClass =
  "h-11 w-full rounded-md border border-line bg-bg px-3 outline-none transition placeholder:text-dim focus:border-fg/50";

/** One-time: connect the new Clerk sign-in to the account created before Clerk. */
export function LinkAccountForm() {
  const [state, action, pending] = useActionState(linkAccount, { ok: false } as ActionState);
  return (
    <form onSubmit={submitTo(action)} className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-sm text-muted">Your old MovieTracker username</span>
        <input name="username" autoComplete="username" required className={inputClass} />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm text-muted">Your old MovieTracker password</span>
        <input name="password" type="password" autoComplete="current-password" required className={inputClass} />
      </label>
      {state.error && <p className="text-sm text-accent">{state.error}</p>}
      <button disabled={pending} className="h-11 w-full rounded-md bg-accent font-semibold text-white transition hover:bg-accent-hover disabled:opacity-60">
        {pending ? "Linking…" : "Link my account"}
      </button>
    </form>
  );
}
