"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(hover: none) and (pointer: coarse)";

function subscribe(onChange: () => void) {
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

/** True on phones and tablets (no hover, finger input). Always false while rendering on the server. */
export function useIsTouch() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
