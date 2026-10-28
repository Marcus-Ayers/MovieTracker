import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/page";
import { SignInNotice } from "@/components/profile/profile-nav";
import { RecapYears } from "@/components/recap/recap-view";
import { getCurrentUser } from "@/lib/auth";

/**
 * /recap — a card for each year in your diary (components/recap/recap-view.tsx).
 */

export const metadata: Metadata = { title: "Year in review" };

async function MyRecaps() {
  const user = await getCurrentUser();
  if (!user) return <SignInNotice section="recap" />;
  return <RecapYears profile={user} isOwn base="" />;
}

export default function RecapPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <MyRecaps />
    </Suspense>
  );
}
