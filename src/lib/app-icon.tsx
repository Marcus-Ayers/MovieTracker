import { ImageResponse } from "next/og";

/**
 * The placeholder app icon (until the site has a name): a white clapperboard on a red gradient. Square and
 * full-bleed, because iPhones round the corners themselves.
 */
export function appIcon(size: number) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(145deg, #ff2a35 0%, #e50914 45%, #8f0510 100%)",
        }}
      >
        {/* Lucide's clapperboard (the icon the site uses elsewhere). */}
        <svg width={size * 0.58} height={size * 0.58} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="m12.296 3.464 3.02 3.956" />
          <path d="M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3z" />
          <path d="M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <path d="m6.18 5.276 3.1 3.899" />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
