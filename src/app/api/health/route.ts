import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const startTime = Date.now();
  let dbStatus = "healthy";

  try {
    // Quick probe to ensure database connectivity
    await db.$queryRaw`SELECT 1`;
  } catch (error) {
    dbStatus = "unreachable";
    console.error("Health check DB error:", error);
  }

  const responseTimeMs = Date.now() - startTime;

  const healthData = {
    name: "Signal Job API",
    status: dbStatus === "healthy" ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: dbStatus,
    responseTimeMs,
    version: "0.1.0-mvp",
    features: {
      ai_extraction: true,
      telegram_bot: true,
      matching_engine: true,
    },
  };

  return NextResponse.json(healthData, {
    status: dbStatus === "healthy" ? 200 : 503,
  });
}
