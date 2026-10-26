import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";

export async function NavUser() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <Link href="/login" className="rounded bg-accent px-3 py-1.5 text-sm font-semibold text-white hover:bg-accent-hover">
        Sign in
      </Link>
    );
  }
  return (
    <Link
      href="/settings"
      title={`${user.displayName} · Settings`}
      className="grid size-8 place-items-center rounded bg-accent text-sm font-bold text-white ring-offset-2 ring-offset-bg hover:ring-2 hover:ring-fg"
    >
      {user.displayName.slice(0, 1).toUpperCase()}
    </Link>
  );
}
