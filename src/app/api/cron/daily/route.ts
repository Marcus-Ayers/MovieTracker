import type { NextRequest } from "next/server";
import { runDailyJobs } from "@/lib/jobs";

/** Called once a day by Vercel Cron (see vercel.json). Vercel sends `Authorization: Bearer $CRON_SECRET`. */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  return Response.json(await runDailyJobs());
}
