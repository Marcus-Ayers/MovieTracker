import { appIcon } from "@/lib/app-icon";

const SIZES = [192, 512];

/** The app icon at the sizes the web app manifest lists (/pwa-icon/192, /pwa-icon/512). */
export async function GET(_request: Request, { params }: { params: Promise<{ size: string }> }) {
  const size = Number((await params).size);
  if (!SIZES.includes(size)) return new Response("Not found", { status: 404 });
  const image = appIcon(size);
  image.headers.set("Cache-Control", "public, max-age=86400, immutable");
  return image;
}
