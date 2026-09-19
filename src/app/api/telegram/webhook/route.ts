/**
 * Telegram webhook route — receives updates from Telegram.
 * Thin dispatcher: validates payload, routes to handler functions.
 * No business logic here.
 *
 * IMPORTANT: Returns 200 OK immediately after parsing the update.
 * Processing runs in a detached promise so Telegram never waits on us.
 * This prevents the 5-second Telegram timeout and eliminates retry storms
 * caused by slow DB queries or Telegram API calls in handlers.
 */

import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import {
  handleStart,
  handlePreferences,
  handleJobs,
  handleSaved,
  handleNotifications,
  handlePause,
  handleResume,
  handleHelp,
  handleCallbackQuery,
} from "@/services/telegram/handlers";

import { TelegramApiError } from "@/services/telegram/client";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // Validate webhook secret token if configured
  const secretHeader = req.headers.get("x-telegram-bot-api-secret-token");
  if (
    env.TELEGRAM_WEBHOOK_SECRET &&
    env.TELEGRAM_WEBHOOK_SECRET !== "local_dev_webhook_secret_key" &&
    secretHeader !== env.TELEGRAM_WEBHOOK_SECRET
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let update: any;
  try {
    update = await req.json();
  } catch {
    // Malformed body — still return 200 to stop Telegram retrying
    return NextResponse.json({ ok: true });
  }

  // Fire-and-forget: process the update asynchronously so we can return 200 instantly.
  // On Railway/persistent Node.js servers, the detached promise continues running after response.
  processUpdate(update).catch((err) => {
    // Silently ignore harmless Telegram 400s that occur under normal heavy usage:
    //  - "message is not modified": user double-tapped a button; bot tried to edit
    //    with identical content — Telegram rejects as no-op, user sees nothing wrong.
    //  - "query is too old": user tapped a button but our response took longer than
    //    Telegram's ~30s callback window; no action needed.
    if (err instanceof TelegramApiError && err.errorCode === 400) {
      const msg = (err.message || "").toLowerCase();
      if (
        msg.includes("message is not modified") ||
        msg.includes("query is too old") ||
        msg.includes("query id is invalid")
      ) {
        return; // Expected UX artifact — not a real error
      }
    }
    console.error("[Telegram Webhook] Unhandled error in processUpdate:", err);
  });

  // Return 200 immediately — Telegram is satisfied, no retry triggered.
  return NextResponse.json({ ok: true });
}

/**
 * Processes a Telegram update object.
 * Runs after the HTTP response has already been sent.
 */
async function processUpdate(update: any) {
  // ── Handle regular text messages / commands ──────────────────────────────
  if (update.message) {
    const msg = update.message;
    const chatId: string | number = msg.chat.id;
    const from = msg.from;
    const text: string = msg.text ?? "";

    if (!from) return;

    const command = text.split(" ")[0].toLowerCase().split("@")[0];

    switch (command) {
      case "/start":
        await handleStart(chatId, from);
        break;
      case "/preferences":
        await handlePreferences(chatId, from);
        break;
      case "/jobs":
        await handleJobs(chatId, from);
        break;
      case "/saved":
        await handleSaved(chatId, from);
        break;
      case "/notifications":
        await handleNotifications(chatId, from);
        break;
      case "/pause":
        await handlePause(chatId, from);
        break;
      case "/resume":
        await handleResume(chatId, from);
        break;
      case "/help":
        await handleHelp(chatId);
        break;
      default:
        if (text && !text.startsWith("/")) {
          // Ignore non-command plain text silently (user typing)
        } else if (text.startsWith("/")) {
          await handleHelp(chatId);
        }
        break;
    }
  }

  // ── Handle button/inline keyboard callbacks ───────────────────────────────
  if (update.callback_query) {
    const cq = update.callback_query;
    const chatId = cq.message?.chat.id;
    const messageId = cq.message?.message_id;
    const from = cq.from;
    const data: string = cq.data ?? "";

    if (chatId && from && data) {
      await handleCallbackQuery(cq.id, chatId, from, data, messageId);
    }
  }
}
