import { SignUp } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Suspense } from "react";

/**
 * /sign-up — Clerk's sign-up form. The [[...sign-up]] folder name lets Clerk use extra steps under it (e.g. email
 * verification).
 */

export const metadata: Metadata = { title: "Create account" };

export default function SignUpPage() {
  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4 pb-10 pt-28">
      <Suspense fallback={<div className="h-[560px] w-[400px] animate-pulse rounded-xl bg-surface" />}>
        <SignUp />
      </Suspense>
    </div>
  );
}
