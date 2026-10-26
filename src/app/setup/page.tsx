import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SetupForm } from "@/components/auth-forms";
import { getOwner } from "@/lib/auth";

export const metadata: Metadata = { title: "Create account" };

async function SetupGate() {
  // Only the very first visit can create an account.
  if (await getOwner()) redirect("/login");
  return <SetupForm />;
}

export default function SetupPage() {
  return (
    <Suspense fallback={<div className="min-h-[60vh]" />}>
      <SetupGate />
    </Suspense>
  );
}
