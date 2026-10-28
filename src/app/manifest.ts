import type { MetadataRoute } from "next";

/** Makes the site installable: "Add to Home Screen" opens it full-screen, like an app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MovieTracker",
    short_name: "MovieTracker",
    description: "Find something to watch, and keep a diary of everything you've seen.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0b0b0e",
    theme_color: "#0b0b0e",
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png" },
    ],
  };
}
