import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { notificationDispatcher } from "@/services/notifications/notifier";

export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const maxRetries = body.maxRetries ? Number(body.maxRetries) : 3;

    const result = await notificationDispatcher.retryFailedNotifications(maxRetries);

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error: any) {
    console.error("Retry Notifications API Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to retry notifications" },
      { status: 500 }
    );
  }
}
