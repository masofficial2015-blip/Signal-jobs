/**
 * Webhook setup endpoint — registers or removes the Telegram bot webhook.
 * GET  /api/telegram/setup → show current webhook info
 * POST /api/telegram/setup → register webhook URL
 * DELETE /api/telegram/setup → remove webhook
 *
 * Protected: only callable with ADMIN_SESSION_SECRET header in production.
 */

import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getAdminSession } from "@/lib/auth";

const TELEGRAM_API = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}`;
const IS_MOCK = !env.TELEGRAM_BOT_TOKEN || env.TELEGRAM_BOT_TOKEN === "mock_telegram_bot_token";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Admin authentication required" }, { status: 401 });
  }

  if (IS_MOCK) {
    return NextResponse.json({ ok: true, mock: true, info: "Telegram bot token not configured" });
  }

  const res = await fetch(`${TELEGRAM_API}/getWebhookInfo`);
  const data = await res.json();
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Admin authentication required" }, { status: 401 });
  }

  if (IS_MOCK) {
    return NextResponse.json({ ok: true, mock: true, message: "Mock mode: webhook not registered" });
  }

  const webhookUrl = env.TELEGRAM_WEBHOOK_URL;
  if (!webhookUrl || webhookUrl.includes("yourdomain")) {
    return NextResponse.json(
      { error: "TELEGRAM_WEBHOOK_URL is not configured with a real URL" },
      { status: 400 }
    );
  }

  const body: Record<string, unknown> = {
    url: webhookUrl,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: false,
  };

  if (env.TELEGRAM_WEBHOOK_SECRET) {
    body.secret_token = env.TELEGRAM_WEBHOOK_SECRET;
  }

  const res = await fetch(`${TELEGRAM_API}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Admin authentication required" }, { status: 401 });
  }

  if (IS_MOCK) {
    return NextResponse.json({ ok: true, mock: true, message: "Mock mode: nothing to remove" });
  }

  const res = await fetch(`${TELEGRAM_API}/deleteWebhook`, { method: "POST" });
  const data = await res.json();
  return NextResponse.json(data);
}
