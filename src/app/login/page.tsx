import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth-forms";
import { getCurrentUser, getOwner } from "@/lib/auth";

export const metadata: Metadata = { title: "Sign in" };

async function LoginGate({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const [{ next }, owner, user] = await Promise.all([searchParams, getOwner(), getCurrentUser()]);
  const target = typeof next === "string" ? next : "";
  if (!owner) redirect("/setup");
  if (user) redirect(target.startsWith("/") && !target.startsWith("//") ? target : "/");
  return <LoginForm next={target} />;
}

export default function LoginPage(props: PageProps<"/login">) {
  return (
    <Suspense fallback={<div className="min-h-[60vh]" />}>
      <LoginGate searchParams={props.searchParams} />
    </Suspense>
  );
}
