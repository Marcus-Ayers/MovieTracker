import { ImageResponse } from "next/og";
import { SeatRow } from "@/components/brand-mark";

/**
 * The app icon: Row Six's row of seats on a near-black tile. Square and full-bleed, because iPhones round the
 * corners themselves. The larger sizes (home screen) add the cinema screen above the seats; the browser-tab icon
 * leaves it out and makes the seats as big as they'll go.
 */
export function appIcon(size: number) {
  const large = size >= 120;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(160deg, #202027 0%, #0b0b0e 65%)",
        }}
      >
        <SeatRow screen={large} width={Math.round(size * (large ? 0.8 : 0.88))} />
      </div>
    ),
    { width: size, height: size },
  );
}
