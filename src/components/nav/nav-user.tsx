import Link from "next/link";
import { getCurrentUser, getSignInState } from "@/lib/auth";
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
  const user = await getCurrentUser();
  return (
    <div className="flex items-center gap-3">
      {state === "needs-link" && (
        <Link href="/account" className="rounded bg-gold px-3 py-1.5 text-xs font-semibold text-black">
          Finish setup
        </Link>
      )}
      <AccountMenu username={user?.username ?? null} />
    </div>
  );
}
