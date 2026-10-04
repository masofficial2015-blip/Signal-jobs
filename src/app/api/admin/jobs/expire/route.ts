import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { jobLifecycleService } from "@/services/jobs/lifecycle";
import { invalidateBrowseCache } from "@/services/telegram/jobBrowseService";

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

export async function DELETE(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();

    // First mark any outdated deadline jobs as EXPIRED
    await jobLifecycleService.checkAndExpireJobs({ adminId: session.adminId });

    // Find all expired jobs
    const expiredJobs = await db.job.findMany({
      where: {
        OR: [
          { status: "EXPIRED" },
          { deadline: { lt: now } },
        ],
      },
      select: { id: true },
    });

    const count = expiredJobs.length;
    if (count > 0) {
      const ids = expiredJobs.map((j) => j.id);
      await db.job.deleteMany({
        where: { id: { in: ids } },
      });

      invalidateBrowseCache();

      await db.adminLog.create({
        data: {
          adminId: session.adminId,
          action: "BULK_DELETE_EXPIRED_JOBS",
          details: `Permanently deleted ${count} expired job(s).`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      deletedCount: count,
      message: `Successfully deleted ${count} expired job${count === 1 ? "" : "s"}.`,
    });
  } catch (error: any) {
    console.error("Bulk Delete Expired Jobs Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to delete expired jobs" },
      { status: 500 }
    );
  }
}
