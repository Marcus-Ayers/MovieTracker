import Link from "next/link";
import { getSignInState } from "@/lib/auth";
import { AccountMenu } from "./account-menu";

export async function NavUser() {
  const state = await getSignInState();
  if (state === "signed-out") {
    return (
      <Link href="/sign-in" className="rounded bg-accent px-3 py-1.5 text-sm font-semibold text-white hover:bg-accent-hover">
        Sign in
      </Link>
    );
  }
  return (
    <div className="flex items-center gap-3">
      {state === "needs-link" && (
        <Link href="/account" className="rounded bg-gold px-3 py-1.5 text-xs font-semibold text-black">
          Link your account
        </Link>
      )}
      <AccountMenu state={state} />
    </div>
  );
}
