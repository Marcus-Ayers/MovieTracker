import { getCurrentUser } from "@/lib/auth";
import { countIncomingRequests } from "@/lib/friends";
import { TabBar } from "./tab-bar";

/** The phone tab bar, with what it needs to know about you. */
export async function TabBarGate() {
  const user = await getCurrentUser();
  const requests = user?.social ? await countIncomingRequests(user.id) : 0;
  return (
    <TabBar
      user={user ? { username: user.username, displayName: user.displayName, social: user.social, requests } : null}
    />
  );
}
