import { Link2 } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LinkAccountForm, StartFreshButton } from "@/components/auth-forms";
import { getSignInState } from "@/lib/auth";

export const metadata: Metadata = { title: "Account" };

/** Where a first Clerk sign-in lands while an account from before Clerk is still waiting to be linked. */
async function AccountGate() {
  const state = await getSignInState();
  if (state === "signed-out") redirect("/sign-in?redirect_url=/account");
  if (state === "signed-in") redirect("/");

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-line bg-surface p-8">
        <Link2 className="mb-4 size-8 text-accent" />
        <h1 className="text-2xl font-bold">Link your existing account</h1>
        <p className="mb-6 mt-2 text-sm text-muted">
          Sign-in now goes through Clerk. If you made an account here before that, confirm its username and password once, and this sign-in will open
          your existing diary, ratings and watchlist. Your old password is deleted afterwards.
        </p>
        <LinkAccountForm />
      </div>
      <div className="rounded-xl border border-line bg-surface p-8">
        <h2 className="text-lg font-bold">New here?</h2>
        <p className="mb-5 mt-1 text-sm text-muted">Skip linking and start with an empty diary of your own.</p>
        <StartFreshButton />
      </div>
    </div>
  );
}

export default function AccountPage() {
  return (
    <div className="mx-auto w-full max-w-md px-4 pb-10 pt-32">
      <Suspense fallback={<div className="min-h-[40vh]" />}>
        <AccountGate />
      </Suspense>
    </div>
  );
}
