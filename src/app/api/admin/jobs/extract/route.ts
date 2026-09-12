import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { aiJobExtractor } from "@/services/ai/gemini";

export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { rawText, sourceName, sourceUrl } = body;

    if (!rawText || typeof rawText !== "string" || rawText.trim().length < 10) {
      return NextResponse.json(
        { error: "Raw job text is required and must be at least 10 characters." },
        { status: 400 }
      );
    }

    const extractedJobs = await aiJobExtractor.extractJobDetails(
      rawText,
      sourceName || null,
      sourceUrl || null
    );

    return NextResponse.json({ success: true, extractedJobs, count: extractedJobs.length });
  } catch (error: unknown) {
    console.error("AI Extraction API Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "AI processing failed" },
      { status: 500 }
    );
  }
}
