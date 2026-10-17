import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { notificationDispatcher } from "@/services/notifications/notifier";
import { invalidateBrowseCache } from "@/services/telegram/jobBrowseService";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const existingJob = await db.job.findUnique({ where: { id } });

    if (!existingJob) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const updatedJob = await db.job.update({
      where: { id },
      data: {
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
    });

    // Record admin log action
    await db.adminLog.create({
      data: {
        adminId: session.adminId,
        action: "PUBLISH_JOB",
        details: `1-Click Published Job ID: ${id} (${updatedJob.title}) from Ingestion Queue`,
      },
    });

    // Invalidate bot browse cache and dispatch notifications async
    invalidateBrowseCache();
    notificationDispatcher.dispatchJobNotificationsAsync(id);

    return NextResponse.json({
      success: true,
      job: updatedJob,
      message: `Job "${updatedJob.title}" published! Matching notifications are dispatching.`,
    });
  } catch (error: any) {
    console.error("[Publish Job API Error]:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to publish job" },
      { status: 500 }
    );
  }
}
