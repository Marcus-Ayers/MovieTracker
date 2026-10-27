import { SignOutButton } from "@clerk/nextjs";
import { Link2, Lock } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LinkAccountForm } from "@/components/auth-forms";
import { getOwner, getSignInState } from "@/lib/auth";

export const metadata: Metadata = { title: "Account" };

/** Where a Clerk sign-in lands when it isn't connected to an account on this site yet. */
async function AccountGate() {
  const state = await getSignInState();
  if (state === "signed-out") redirect("/sign-in?redirect_url=/account");
  if (state === "linked") redirect("/");

  if (state === "needs-link") {
    return (
      <div className="rounded-xl border border-line bg-surface p-8">
        <Link2 className="mb-4 size-8 text-accent" />
        <h1 className="text-2xl font-bold">Link your existing account</h1>
        <p className="mb-6 mt-2 text-sm text-muted">
          Sign-in now goes through Clerk. Confirm the username and password you used before, once, and this Clerk sign-in will open your existing
          diary, ratings and watchlist. Your old password is deleted afterwards.
        </p>
        <LinkAccountForm />
      </div>
    );
  }

  const owner = await getOwner();
  return (
    <div className="rounded-xl border border-line bg-surface p-8 text-center">
      <Lock className="mx-auto mb-4 size-8 text-accent" />
      <h1 className="text-2xl font-bold">This site belongs to {owner?.displayName ?? "someone else"}</h1>
      <p className="mb-6 mt-2 text-sm text-muted">You&apos;re signed in, but only the owner can log and review here. You can still browse everything.</p>
      <SignOutButton>
        <button className="rounded border border-line px-5 py-2 text-sm hover:border-fg/40">Sign out</button>
      </SignOutButton>
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
