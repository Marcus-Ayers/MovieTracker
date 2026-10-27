import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // PGlite (the local dev database) ships WASM files that must be loaded from node_modules, not bundled.
  serverExternalPackages: ["@electric-sql/pglite"],
  // Old login URLs from before Clerk.
  async redirects() {
    return [
      { source: "/login", destination: "/sign-in", permanent: true },
      { source: "/setup", destination: "/sign-up", permanent: true },
    ];
  },
  images: {
    // TMDB already serves pre-sized images, so skip Vercel's optimizer (keeps us inside the free tier).
    unoptimized: true,
    remotePatterns: [new URL("https://image.tmdb.org/t/p/**"), new URL("https://i.ytimg.com/vi/**")],
  },
  turbopack: {
    // There's an unrelated lockfile in your home folder; pin the project root so Turbopack ignores it.
    root: process.cwd(),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
