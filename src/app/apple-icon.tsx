import { appIcon } from "@/lib/app-icon";

// Logo version 2 (the seat row). See icon.tsx: bump this after redrawing the logo, so iPhones fetch the new one.

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** The iPhone home-screen icon. */
export default function AppleIcon() {
  return appIcon(180);
}
