import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { Prisma } from "@prisma/client";

function parseJsonArray(jsonStr?: string | null): string[] {
  if (!jsonStr) return [];
  try {
    const parsed = JSON.parse(jsonStr);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { category, experience, location, status, onboarding } = body;

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

    const users = await db.user.findMany({
      where,
      include: {
        preference: true,
      },
    });

    const filteredUsers = users.filter((u) => {
      if (!onboarding || onboarding === "all") return true;
      
      const categories = parseJsonArray(u.preference?.categories);
      const locations = parseJsonArray(u.preference?.locations);
      const expLevels = parseJsonArray(u.preference?.experienceLevels);
      
      const isOnboarded = categories.length > 0 || expLevels.length > 0 || locations.length > 0;
      
      if (onboarding === "completed") return isOnboarded;
      if (onboarding === "pending") return !isOnboarded;
      
      return true;
    });

    return NextResponse.json({ count: filteredUsers.length });
  } catch (error: any) {
    console.error("Audience check error:", error);
    return NextResponse.json(
      { error: "Failed to calculate audience" },
      { status: 500 }
    );
  }
}
