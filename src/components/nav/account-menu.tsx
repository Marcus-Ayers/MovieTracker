"use client";

import { UserButton } from "@clerk/nextjs";
import { Download, Link2, Settings, Upload, UserRound } from "lucide-react";

/**
 * Clerk's account button (manage account, sign out) plus shortcuts to this site's own pages.
 * `username` is null while a first sign-in still has to finish setting up (link or start fresh).
 */
export function AccountMenu({ username }: { username: string | null }) {
  return (
    <UserButton>
      <UserButton.MenuItems>
        {username && <UserButton.Link label="Your public profile" labelIcon={<UserRound className="size-4" />} href={`/u/${username}`} />}
        {username && <UserButton.Link label="Settings" labelIcon={<Settings className="size-4" />} href="/settings" />}
        {username && <UserButton.Link label="Import or restore" labelIcon={<Upload className="size-4" />} href="/settings/import" />}
        {username && <UserButton.Link label="Export everything" labelIcon={<Download className="size-4" />} href="/api/export" />}
        {!username && <UserButton.Link label="Finish setting up" labelIcon={<Link2 className="size-4" />} href="/account" />}
      </UserButton.MenuItems>
    </UserButton>
  );
}
