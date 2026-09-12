import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status && status !== "ALL") {
      where.status = status;
    }

    const [notifications, total, counts] = await Promise.all([
      db.notification.findMany({
        where,
        include: {
          user: {
            select: {
              telegramId: true,
              telegramUsername: true,
              firstName: true,
              lastName: true,
            },
          },
          job: {
            select: {
              id: true,
              title: true,
              company: true,
              category: true,
              location: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.notification.count({ where }),
      db.notification.groupBy({
        by: ["status"],
        _count: { status: true },
      }),
    ]);

    const stats = {
      total: 0,
      sent: 0,
      failed: 0,
      pending: 0,
    };

    counts.forEach((c) => {
      stats.total += c._count.status;
      if (c.status === "SENT") stats.sent = c._count.status;
      if (c.status === "FAILED") stats.failed = c._count.status;
      if (c.status === "PENDING") stats.pending = c._count.status;
    });

    return NextResponse.json({
      success: true,
      notifications,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      stats,
    });
  } catch (error: any) {
    console.error("GET Notifications Error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
