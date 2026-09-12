import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { jobLifecycleService } from "@/services/jobs/lifecycle";

export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const maxAgeDays = body.maxAgeDays ? Number(body.maxAgeDays) : 30;

    const result = await jobLifecycleService.checkAndExpireJobs({
      maxAgeDays,
      adminId: session.adminId,
    });

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error: any) {
    console.error("Job Expiration API Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to process job expiration" },
      { status: 500 }
    );
  }
}
