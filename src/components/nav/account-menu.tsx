"use client";

import { UserButton } from "@clerk/nextjs";
import { Download, Link2, Settings, Upload } from "lucide-react";
import type { SignInState } from "@/lib/auth";

/** Clerk's account button (manage account, sign out) plus shortcuts to this site's own pages. */
export function AccountMenu({ state }: { state: Exclude<SignInState, "signed-out"> }) {
  return (
    <UserButton>
      <UserButton.MenuItems>
        {state === "linked" && <UserButton.Link label="Settings" labelIcon={<Settings className="size-4" />} href="/settings" />}
        {state === "linked" && <UserButton.Link label="Import or restore" labelIcon={<Upload className="size-4" />} href="/settings/import" />}
        {state === "linked" && <UserButton.Link label="Export everything" labelIcon={<Download className="size-4" />} href="/api/export" />}
        {state === "needs-link" && <UserButton.Link label="Link your account" labelIcon={<Link2 className="size-4" />} href="/account" />}
      </UserButton.MenuItems>
    </UserButton>
  );
}
