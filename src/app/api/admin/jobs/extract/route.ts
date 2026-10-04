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
    const { rawText, sourceName, sourceUrl, base64Image, mimeType } = body;

    const hasValidText = rawText && typeof rawText === "string" && rawText.trim().length >= 10;
    const hasValidImage = base64Image && typeof base64Image === "string" && mimeType && typeof mimeType === "string";

    if (!hasValidText && !hasValidImage) {
      return NextResponse.json(
        { error: "Please provide either raw job text (at least 10 chars) or a valid image." },
        { status: 400 }
      );
    }

    const extractedJobs = await aiJobExtractor.extractJobDetails(
      rawText || "",
      sourceName || null,
      sourceUrl || null,
      base64Image || undefined,
      mimeType || undefined
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
