import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, setAdminSessionCookie, ensureDefaultAdminExists } from "@/lib/auth";
import { loginRateLimiter } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    // 1. IP-based rate limiting
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "127.0.0.1";

    const rateLimit = loginRateLimiter.check(ip);
    if (!rateLimit.success) {
      const minutes = Math.ceil(rateLimit.retryAfterSeconds / 60);
      return NextResponse.json(
        {
          error: `Too many login attempts. Please try again in ${minutes} minute${minutes > 1 ? "s" : ""}.`,
        },
        {
          status: 429,
          headers: {
            "Retry-After": rateLimit.retryAfterSeconds.toString(),
            "X-RateLimit-Limit": rateLimit.limit.toString(),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": Math.ceil(rateLimit.resetTime / 1000).toString(),
          },
        }
      );
    }

    // Ensure at least default admin exists
    await ensureDefaultAdminExists();

    const body = await req.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }

    // Find admin account by username or email
    const admin = await db.adminUser.findFirst({
      where: {
        OR: [
          { username: username.trim() },
          { email: username.trim().toLowerCase() },
        ],
      },
    });

    if (!admin) {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }

    const isValid = await verifyPassword(password, admin.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }

    // Reset rate limiter on successful authentication
    loginRateLimiter.reset(ip);

    // Update last login timestamp
    await db.adminUser.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    // Set HTTP-only session cookie
    await setAdminSessionCookie({
      adminId: admin.id,
      username: admin.username,
      email: admin.email,
      role: admin.role,
    });

    return NextResponse.json({
      success: true,
      user: {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        role: admin.role,
      },
    });
  } catch (error) {
    console.error("Admin login API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
