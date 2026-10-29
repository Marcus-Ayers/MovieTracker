import { getCurrentUser } from "@/lib/auth";
import { backupToZip, buildBackup } from "@/lib/backup";

/** Downloads everything you've logged as a ZIP (full JSON backup + CSVs). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Sign in to export your data." }, { status: 401 });
  const zip = backupToZip(await buildBackup(user.id));
  const day = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD in the server's time zone
  return new Response(new Blob([new Uint8Array(zip)]), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="rowsix-export-${day}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
