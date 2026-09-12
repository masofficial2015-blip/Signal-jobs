import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "signal_admin_session";
const sessionSecret =
  process.env.ADMIN_SESSION_SECRET ||
  (process.env.NODE_ENV === "production" ? "" : "signal_job_super_secret_session_key_32_chars");
const SECRET = new TextEncoder().encode(sessionSecret);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only run middleware logic on /admin paths
  if (pathname.startsWith("/admin")) {
    const isLoginPage = pathname === "/admin/login";
    const token = request.cookies.get(COOKIE_NAME)?.value;

    let isAuthenticated = false;
    if (token) {
      try {
        await jwtVerify(token, SECRET);
        isAuthenticated = true;
      } catch {
        isAuthenticated = false;
      }
    }

    // Redirect unauthenticated admin access to login
    if (!isAuthenticated && !isLoginPage) {
      const loginUrl = new URL("/admin/login", request.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Redirect already authenticated admin away from login page
    if (isAuthenticated && isLoginPage) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
