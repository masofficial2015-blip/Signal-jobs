import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { Prisma } from "@prisma/client";
import { telegramClient } from "@/services/telegram/client";

function parseJsonArray(jsonStr?: string | null): string[] {
  if (!jsonStr) return [];
  try {
    const parsed = JSON.parse(jsonStr);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Background fire-and-forget sender
async function sendBroadcastBackground(users: { telegramId: string }[], message: string) {
  let success = 0;
  let failed = 0;

  for (const user of users) {
    try {
      await telegramClient.sendMessage({
        chatId: user.telegramId,
        text: message,
        parseMode: "HTML", // Safe fallback
      });
      success++;
    } catch (err) {
      console.error(`Broadcast failed for ${user.telegramId}`, err);
      failed++;
    }
    // Respect Telegram limits: ~30 msgs/sec limit, we wait 50ms (20/sec)
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  
  console.log(`[Broadcast Completed] Success: ${success}, Failed: ${failed}`);
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { category, experience, location, status, onboarding, message } = body;

    if (!message || message.trim().length === 0) {
      return NextResponse.json({ error: "Message cannot be empty" }, { status: 400 });
    }

    const where: Prisma.UserWhereInput = {};

    if (status === "active") {
      where.isActive = true;
      where.notificationsPaused = false;
    } else if (status === "paused") {
      where.isActive = true;
      where.notificationsPaused = true;
    } else if (status === "inactive") {
      where.isActive = false;
    }

    const prefWhere: any = {};
    let hasPrefWhere = false;

    if (category && category !== "all") {
      prefWhere.categories = { contains: `"${category}"` };
      hasPrefWhere = true;
    }
    if (location && location !== "all") {
      prefWhere.locations = { contains: `"${location}"` };
      hasPrefWhere = true;
    }
    if (experience && experience !== "all") {
      prefWhere.experienceLevels = { contains: `"${experience}"` };
      hasPrefWhere = true;
    }

    if (hasPrefWhere) {
      where.preference = prefWhere;
    }

    // Cursor-paginated user fetch — keeps memory flat at any user count.
    // Avoids loading all users at once (crash risk at 1,000+ users).
    const BATCH_SIZE = 200;
    const allUsers: { telegramId: string; preference: { categories: string; locations: string; experienceLevels: string } | null }[] = [];
    let cursor: string | undefined;

    while (true) {
      const batch = await db.user.findMany({
        where,
        select: {
          id: true,
          telegramId: true,
          preference: {
            select: { categories: true, locations: true, experienceLevels: true },
          },
        },
        orderBy: { id: "asc" },
        take: BATCH_SIZE,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      });

      if (batch.length === 0) break;
      allUsers.push(...batch);
      cursor = batch[batch.length - 1].id;
      if (batch.length < BATCH_SIZE) break;
    }

    const filteredUsers = allUsers.filter((u) => {
      if (!onboarding || onboarding === "all") return true;
      
      const categories = parseJsonArray(u.preference?.categories);
      const locations = parseJsonArray(u.preference?.locations);
      const expLevels = parseJsonArray(u.preference?.experienceLevels);
      
      const isOnboarded = categories.length > 0 || expLevels.length > 0 || locations.length > 0;
      
      if (onboarding === "completed") return isOnboarded;
      if (onboarding === "pending") return !isOnboarded;
      
      return true;
    });

    // Fire and forget
    sendBroadcastBackground(filteredUsers, message).catch(console.error);

    return NextResponse.json({ success: true, count: filteredUsers.length });
  } catch (error: any) {
    console.error("Broadcast send error:", error);
    return NextResponse.json(
      { error: "Failed to dispatch broadcast" },
      { status: 500 }
    );
  }
}
