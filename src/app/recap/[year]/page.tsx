import type { Metadata } from "next";
import { Suspense } from "react";
import { DynamicMarker } from "@/components/dynamic-marker";
import { PageSkeleton } from "@/components/page";
import { SignInNotice } from "@/components/profile/profile-nav";
import { RecapView } from "@/components/recap/recap-view";
import { getCurrentUser } from "@/lib/auth";
import { parseRecapYear } from "@/lib/recap-year";

export async function generateMetadata(props: PageProps<"/recap/[year]">): Promise<Metadata> {
  const { year } = await props.params;
  return { title: `${year} in review` };
}

async function MyRecap({ params }: { params: PageProps<"/recap/[year]">["params"] }) {
  const year = parseRecapYear((await params).year);
  const user = await getCurrentUser();
  if (!user) return <SignInNotice section="recap" />;
  return <RecapView profile={user} isOwn base="" year={year} />;
}

export default function RecapYearPage(props: PageProps<"/recap/[year]">) {
  return (
    <>
      <Suspense fallback={<PageSkeleton />}>
        <MyRecap params={props.params} />
      </Suspense>
      <DynamicMarker />
    </>
  );
}
