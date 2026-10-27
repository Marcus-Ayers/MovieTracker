"use client";

import { UserButton } from "@clerk/nextjs";
import { Download, Link2, Settings, Sparkles, Star, Upload, UserRound, Users } from "lucide-react";

/**
 * Clerk's account button (manage account, sign out) plus shortcuts to this site's own pages.
 * `username` is null while a first sign-in still has to finish setting up (link or start fresh).
 */
export function AccountMenu({ username, social }: { username: string | null; social: boolean }) {
  return (
    <UserButton>
      <UserButton.MenuItems>
        {username && <UserButton.Link label="Your public profile" labelIcon={<UserRound className="size-4" />} href={`/u/${username}`} />}
        {username && social && <UserButton.Link label="Friends" labelIcon={<Users className="size-4" />} href="/friends" />}
        {username && <UserButton.Link label="Your year in review" labelIcon={<Sparkles className="size-4" />} href="/recap" />}
        {username && <UserButton.Link label="Rate what you've watched" labelIcon={<Star className="size-4" />} href="/rate" />}
        {username && <UserButton.Link label="Settings" labelIcon={<Settings className="size-4" />} href="/settings" />}
        {username && <UserButton.Link label="Import or restore" labelIcon={<Upload className="size-4" />} href="/settings/import" />}
        {username && <UserButton.Link label="Export everything" labelIcon={<Download className="size-4" />} href="/api/export" />}
        {!username && <UserButton.Link label="Finish setting up" labelIcon={<Link2 className="size-4" />} href="/account" />}
      </UserButton.MenuItems>
    </UserButton>
  );
}
