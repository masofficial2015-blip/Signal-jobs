import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { ingestionService } from "@/services/scraper/ingestionService";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    // 1. Allow authenticated admin session OR cron header authorization
    const session = await getAdminSession();
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.ADMIN_SESSION_SECRET;

    const isCronAuthorized = cronSecret && authHeader === `Bearer ${cronSecret}`;

    if (!session && !isCronAuthorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let targetChannels: string[] | undefined;
    let limit = 6;

    try {
      const body = await req.json();
      if (body.channels && Array.isArray(body.channels)) {
        targetChannels = body.channels;
      }
      if (body.limit && typeof body.limit === "number") {
        limit = Math.min(Math.max(body.limit, 1), 15);
      }
    } catch {}

    console.log(`[Scraper API] Starting scraper run (channels: ${targetChannels || "ALL"}, limit: ${limit})...`);
    const summary = await ingestionService.runIngestion(targetChannels, limit);

    return NextResponse.json({
      success: true,
      summary,
    });
  } catch (error: any) {
    console.error("[Scraper API] Run error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to run scraper" },
      { status: 500 }
    );
  }
}
