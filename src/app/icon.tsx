import { appIcon } from "@/lib/app-icon";

// Logo version 2 (the seat row). Browsers keep icons by URL, and Next only changes this icon's URL (its "?hash")
// when this file's text changes. After redrawing the logo, bump the number here and in apple-icon.tsx.

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

/** The browser-tab icon. */
export default function Icon() {
  return appIcon(64);
}
