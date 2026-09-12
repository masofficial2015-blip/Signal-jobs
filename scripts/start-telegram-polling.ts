/**
 * Local Telegram Bot Polling Script (for testing without ngrok/webhooks)
 * Usage: npm run bot:poll
 *        OR: tsx --env-file=.env scripts/start-telegram-polling.ts
 */

// ⚠️ Load .env BEFORE importing env.ts (tsx doesn't auto-load .env)
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) {
  const lines = readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    // Strip surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
  console.log("✅ Loaded .env from:", envPath);
} else {
  console.warn("⚠️  No .env file found at:", envPath);
}

import { env } from "../src/lib/env";
import { handleStart, handleJobs, handlePreferences, handleSaved, handleNotifications, handlePause, handleResume, handleHelp, handleCallbackQuery } from "../src/services/telegram/handlers";

async function startPolling() {
  const token = env.TELEGRAM_BOT_TOKEN;
  if (!token || token === "mock_telegram_bot_token") {
    console.error("❌ Please set a valid TELEGRAM_BOT_TOKEN in .env to run Telegram polling.");
    process.exit(1);
  }

  // First remove any registered webhook so polling works
  await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`);
  console.log("🤖 Telegram Polling Agent Started! Send messages to your bot on Telegram.");
  console.log("Press Ctrl+C to stop.\n");

  let offset = 0;

  while (true) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates?offset=${offset}&timeout=10`);
      const data = await res.json();

      if (data.ok && Array.isArray(data.result)) {
        for (const update of data.result) {
          offset = update.update_id + 1;

          if (update.message && update.message.text) {
            const chatId = update.message.chat.id;
            const from = update.message.from;
            const text = update.message.text.trim();

            console.log(`📩 [Msg from ${from.first_name || from.id}]: ${text}`);

            if (text.startsWith("/start")) await handleStart(chatId, from);
            else if (text.startsWith("/jobs")) await handleJobs(chatId, from);
            else if (text.startsWith("/preferences")) await handlePreferences(chatId, from);
            else if (text.startsWith("/saved")) await handleSaved(chatId, from);
            else if (text.startsWith("/notifications")) await handleNotifications(chatId, from);
            else if (text.startsWith("/pause")) await handlePause(chatId, from);
            else if (text.startsWith("/resume")) await handleResume(chatId, from);
            else if (text.startsWith("/help")) await handleHelp(chatId);
            else await handleStart(chatId, from);
          } else if (update.callback_query) {
            const cb = update.callback_query;
            const chatId = cb.message?.chat.id;
            const messageId = cb.message?.message_id;
            const from = cb.from;
            const data = cb.data;

            console.log(`🔘 [Button click from ${from.first_name || from.id}]: ${data}`);
            if (chatId && data) {
              await handleCallbackQuery(cb.id, chatId, from, data, messageId);
            }
          }
        }
      }
    } catch (err) {
      console.error("Polling error:", err);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
}

startPolling();
