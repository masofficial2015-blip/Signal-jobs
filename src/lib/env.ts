import { z } from "zod";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

// Load .env manually for non-Next.js contexts (e.g., tsx scripts)
// Next.js already handles this automatically, so we only load if vars aren't set yet
const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath) && !process.env.DATABASE_URL) {
  const lines = readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

const envSchema = z
  .object({
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    TELEGRAM_BOT_TOKEN: z.string().default("mock_telegram_bot_token"),
    TELEGRAM_WEBHOOK_URL: z.string().optional(),
    TELEGRAM_WEBHOOK_SECRET: z.string().optional(),
    GEMINI_API_KEY: z.string().default("mock_gemini_api_key"),
    GEMINI_MODEL: z.string().default("gemini-1.5-flash"),
    ADMIN_PASSWORD: z.string().optional(),
    ADMIN_SESSION_SECRET: z.string().optional(),
    NEXT_PUBLIC_APP_URL: z.string().default("http://localhost:3000"),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === "production") {
      if (!data.ADMIN_SESSION_SECRET || data.ADMIN_SESSION_SECRET.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "ADMIN_SESSION_SECRET is required in production environment.",
          path: ["ADMIN_SESSION_SECRET"],
        });
      } else if (data.ADMIN_SESSION_SECRET === "signal_job_super_secret_session_key_32_chars") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "ADMIN_SESSION_SECRET cannot use the public default fallback key in production.",
          path: ["ADMIN_SESSION_SECRET"],
        });
      }

      if (!data.ADMIN_PASSWORD || data.ADMIN_PASSWORD.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "ADMIN_PASSWORD is required in production environment.",
          path: ["ADMIN_PASSWORD"],
        });
      } else if (data.ADMIN_PASSWORD === "admin_dev_password_123") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "ADMIN_PASSWORD cannot use the public default fallback password in production.",
          path: ["ADMIN_PASSWORD"],
        });
      }
    }
  })
  .transform((data) => ({
    ...data,
    ADMIN_SESSION_SECRET:
      data.ADMIN_SESSION_SECRET ||
      (data.NODE_ENV === "production" ? "" : "signal_job_super_secret_session_key_32_chars"),
    ADMIN_PASSWORD:
      data.ADMIN_PASSWORD ||
      (data.NODE_ENV === "production" ? "" : "admin_dev_password_123"),
  }));

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("❌ Invalid environment variables:", parsedEnv.error.format());
  throw new Error("Invalid environment configuration. Please check your .env file.");
}

export const env = parsedEnv.data;
