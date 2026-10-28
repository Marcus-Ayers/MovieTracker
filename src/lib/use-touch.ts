"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(hover: none) and (pointer: coarse)";

// One shared media query for every component that asks (a page can have hundreds of posters).
let media: MediaQueryList | null = null;
const getMedia = () => (media ??= window.matchMedia(QUERY));

function subscribe(onChange: () => void) {
  const m = getMedia();
  m.addEventListener("change", onChange);
  return () => m.removeEventListener("change", onChange);
}

/** True on phones and tablets (no hover, finger input). Always false while rendering on the server. */
export function useIsTouch() {
  return useSyncExternalStore(
    subscribe,
    () => getMedia().matches,
    () => false,
  );
}
