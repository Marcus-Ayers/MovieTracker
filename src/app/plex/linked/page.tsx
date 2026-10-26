import type { Metadata } from "next";
import { PlexLinked } from "./plex-linked";

export const metadata: Metadata = { title: "Plex connected" };

/** Plex sends you here after you approve the sign-in. */
export default function PlexLinkedPage() {
  return <PlexLinked />;
}
