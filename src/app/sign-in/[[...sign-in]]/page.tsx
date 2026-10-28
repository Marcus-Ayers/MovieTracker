import { SignIn } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Suspense } from "react";

/**
 * /sign-in — Clerk's sign-in form. The [[...sign-in]] folder name lets Clerk use extra steps under it (e.g.
 * /sign-in/factor-two).
 */

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4 pb-10 pt-28">
      <Suspense fallback={<div className="h-[480px] w-[400px] animate-pulse rounded-xl bg-surface" />}>
        <SignIn />
      </Suspense>
    </div>
  );
}
