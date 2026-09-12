import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { db } from "./db";
import { env } from "./env";

const COOKIE_NAME = "signal_admin_session";
const SECRET = new TextEncoder().encode(env.ADMIN_SESSION_SECRET);

export interface AdminJwtPayload {
  adminId: string;
  username: string;
  email: string;
  role: string;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSessionToken(payload: AdminJwtPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(SECRET);
}

export async function verifySessionToken(token: string): Promise<AdminJwtPayload | null> {
  try {
    const verified = await jwtVerify(token, SECRET);
    return verified.payload as unknown as AdminJwtPayload;
  } catch {
    return null;
  }
}

export async function setAdminSessionCookie(payload: AdminJwtPayload) {
  const token = await createSessionToken(payload);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24, // 24 hours
  });
}

export async function clearAdminSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function getAdminSession(): Promise<AdminJwtPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

/**
 * Ensures at least one admin account exists in the database.
 * If none exists, creates the default admin user using ADMIN_PASSWORD env variable.
 */
export async function ensureDefaultAdminExists() {
  try {
    const count = await db.adminUser.count();
    if (count === 0) {
      const defaultPassword = env.ADMIN_PASSWORD;
      if (!defaultPassword) {
        console.warn("⚠️ Cannot create default admin user: ADMIN_PASSWORD is empty or not configured.");
        return;
      }
      const hashedPassword = await hashPassword(defaultPassword);
      
      const created = await db.adminUser.create({
        data: {
          username: "admin",
          email: "admin@signaljob.et",
          passwordHash: hashedPassword,
          role: "SUPERADMIN",
        },
      });
      console.log("🔐 Default Admin user created:", created.username);
    }
  } catch (err) {
    console.error("Error ensuring default admin user:", err);
  }
}
