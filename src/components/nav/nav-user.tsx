import { Users } from "lucide-react";
import Link from "next/link";
import { getCurrentUser, getSignInState } from "@/lib/auth";
import { countIncomingRequests } from "@/lib/friends";
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
  const requests = user?.social ? await countIncomingRequests(user.id) : 0;
  return (
    <div className="flex items-center gap-3">
      {state === "needs-link" && (
        <Link href="/account" className="rounded bg-gold px-3 py-1.5 text-xs font-semibold text-black">
          Finish setup
        </Link>
      )}
      {user?.social && (
        <Link
          href="/friends"
          aria-label={requests ? `Friends (${requests} new ${requests === 1 ? "request" : "requests"})` : "Friends"}
          className="relative grid size-8 place-items-center rounded-full text-muted transition hover:text-fg"
        >
          <Users className="size-5" />
          {requests > 0 && (
            <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold leading-4 text-white">
              {requests}
            </span>
          )}
        </Link>
      )}
      <AccountMenu username={user?.username ?? null} social={Boolean(user?.social)} />
    </div>
  );
}
