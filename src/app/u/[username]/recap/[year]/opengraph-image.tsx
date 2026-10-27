import { eq } from "drizzle-orm";
import { ImageResponse } from "next/og";
import { getDb, users } from "@/db";
import { tmdbImage } from "@/lib/format";
import { buildRecap } from "@/lib/recap";

export const alt = "A year in film on MovieTracker";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const RED = "#e50914";

// The site's font (Geist) at a heavy weight, for the big year. Fetched once per server instance.
let geistBlack: Promise<ArrayBuffer | null> | null = null;
function loadGeist() {
  geistBlack ??= fetch("https://fonts.googleapis.com/css2?family=Geist:wght@900")
    .then((res) => res.text())
    .then((css) => css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1])
    .then((url) => (url ? fetch(url).then((res) => res.arrayBuffer()) : null))
    .catch(() => null);
  return geistBlack;
}

/** The preview card when someone pastes a recap link into iMessage, Discord, etc. */
export default async function Image({ params }: { params: Promise<{ username: string; year: string }> }) {
  const { username, year } = await params;
  const db = await getDb();
  const [profile] = await db
    .select({ id: users.id, displayName: users.displayName, visibility: users.visibility })
    .from(users)
    .where(eq(users.username, username.toLowerCase()));
  // Link previews are fetched by bots that aren't signed in, so only public profiles get real numbers.
  const recap = profile?.visibility === "everyone" && /^\d{4}$/.test(year) ? await buildRecap(profile.id, Number(year)) : null;
  const posters = (recap?.topFilms ?? [])
    .map((f) => tmdbImage(f.title.posterPath, "w342"))
    .filter((p): p is string => Boolean(p))
    .slice(0, 3);
  const font = await loadGeist();

  const stat = (label: string, value: string) => (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ fontSize: 64, fontFamily: "Geist", color: "#ededf0" }}>{value}</div>
      <div style={{ fontSize: 22, color: "#a3a3b0", textTransform: "uppercase", letterSpacing: 3 }}>{label}</div>
    </div>
  );

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#0b0b0e", color: "#ededf0", padding: "56px 64px" }}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <div style={{ display: "flex", fontSize: 30, fontFamily: "Geist", letterSpacing: -1 }}>
            <span style={{ color: RED }}>MOVIE</span>
            <span>TRACKER</span>
          </div>
          <div style={{ display: "flex", marginTop: 48, fontSize: 26, color: RED, textTransform: "uppercase", letterSpacing: 6 }}>
            {recap ? `${profile!.displayName}'s year in film` : "Year in review"}
          </div>
          <div style={{ display: "flex", fontSize: 200, fontFamily: "Geist", lineHeight: 1, letterSpacing: -10 }}>{year}</div>
          {recap && (
            <div style={{ display: "flex", gap: 56, marginTop: 28 }}>
              {stat("Films", String(recap.films))}
              {stat("Hours", recap.hours.toLocaleString())}
              {recap.avgRating !== null && stat("Avg rating", recap.avgRating.toFixed(1))}
            </div>
          )}
        </div>
        {posters.length > 0 && (
          <div style={{ display: "flex", position: "relative", width: 420, height: "100%" }}>
            {posters.map((src, i) => (
              <img
                key={src}
                src={src}
                alt=""
                width={220}
                height={330}
                style={{
                  position: "absolute",
                  top: 60 + i * 40,
                  left: i * 90,
                  borderRadius: 14,
                  boxShadow: "0 20px 50px rgba(0,0,0,0.8)",
                  transform: `rotate(${(i - 1) * 6}deg)`,
                }}
              />
            ))}
          </div>
        )}
      </div>
    ),
    { ...size, fonts: font ? [{ name: "Geist", data: font, weight: 900 }] : [] },
  );
}
