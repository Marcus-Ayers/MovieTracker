import { ListCard } from "@/components/lists/list-card";
import { EmptyState, PageHeader } from "@/components/page";
import { ProfileTabs, type ProfileViewProps } from "@/components/profile/profile-nav";
import { plural } from "@/lib/format";
import { getListSummaries } from "@/lib/lists";

/** Someone's lists and tier lists (their profile's Lists tab). */
export async function ListsView({ profile, isOwn, base }: Omit<ProfileViewProps, "searchParams">) {
  const lists = await getListSummaries(profile.id);
  return (
    <>
      <PageHeader title={isOwn ? "Your lists" : `${profile.displayName}'s lists`} subtitle={plural(lists.length, "list")} />
      {base && <ProfileTabs profile={profile} base={base} active="lists" />}
      {lists.length ? (
        <div className="grid grid-cols-2 gap-x-5 gap-y-8 px-4 sm:grid-cols-3 sm:px-8 lg:grid-cols-4 lg:px-12 xl:grid-cols-5">
          {lists.map((l) => (
            <ListCard key={l.id} {...l} />
          ))}
        </div>
      ) : (
        <EmptyState title="No lists yet">{isOwn && "Make one from the Lists page."}</EmptyState>
      )}
    </>
  );
}
