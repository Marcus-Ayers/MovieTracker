"use client";

import { useActionState } from "react";
import { login, setupAccount, type ActionState } from "@/lib/actions";
import { submitTo } from "@/lib/forms";

const inputClass =
  "h-11 w-full rounded-md border border-line bg-bg px-3 outline-none transition placeholder:text-dim focus:border-fg/50";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-muted">{label}</span>
      {children}
    </label>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-md px-4 pb-10 pt-32">
      <div className="rounded-xl border border-line bg-surface/80 p-8 shadow-2xl shadow-black/50 backdrop-blur">
        <h1 className="text-3xl font-black tracking-tight">{title}</h1>
        <p className="mb-7 mt-1 text-sm text-muted">{subtitle}</p>
        {children}
      </div>
    </div>
  );
}

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(login, { ok: false } as ActionState);
  return (
    <Card title="Sign in" subtitle="Welcome back.">
      <form onSubmit={submitTo(action)} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <Field label="Username">
          <input name="username" autoComplete="username" required className={inputClass} />
        </Field>
        <Field label="Password">
          <input name="password" type="password" autoComplete="current-password" required className={inputClass} />
        </Field>
        {state.error && <p className="text-sm text-accent">{state.error}</p>}
        <button disabled={pending} className="h-11 w-full rounded-md bg-accent font-semibold text-white transition hover:bg-accent-hover disabled:opacity-60">
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </Card>
  );
}

export function SetupForm() {
  const [state, action, pending] = useActionState(setupAccount, { ok: false } as ActionState);
  return (
    <Card title="Create your account" subtitle="This is the only account on the site. Visitors can browse, but only you can log and review.">
      <form onSubmit={submitTo(action)} className="space-y-4">
        <Field label="Display name">
          <input name="displayName" required maxLength={60} placeholder="What should the site call you?" className={inputClass} />
        </Field>
        <Field label="Username">
          <input name="username" required autoComplete="username" placeholder="letters, numbers, underscores" className={inputClass} />
        </Field>
        <Field label="Password">
          <input name="password" type="password" required minLength={8} autoComplete="new-password" placeholder="8+ characters" className={inputClass} />
        </Field>
        {state.error && <p className="text-sm text-accent">{state.error}</p>}
        <button disabled={pending} className="h-11 w-full rounded-md bg-accent font-semibold text-white transition hover:bg-accent-hover disabled:opacity-60">
          {pending ? "Creating…" : "Create account"}
        </button>
      </form>
    </Card>
  );
}
