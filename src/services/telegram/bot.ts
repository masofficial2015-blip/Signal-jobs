/**
 * TelegramBotService — high-level helper re-exported for backward compatibility.
 * Used by the notification dispatcher to send job alerts.
 */

import { telegramClient, SendMessageOptions } from "./client";
import { formatExperienceLabel, formatLocationLabel } from "./messages";

export type { SendMessageOptions as SendTelegramMessageOptions };

export class TelegramBotService {
  /**
   * Sends a message to a chat. Thin wrapper over the API client.
   */
  async sendMessage(options: SendMessageOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const result = await telegramClient.sendMessage(options);
    if (!result) {
      // Mock mode or call returned null (error already logged in client)
      return { success: true, messageId: `mock_${Date.now()}` };
    }
    return { success: true, messageId: String(result.message_id) };
  }

  /**
   * Formats a job notification for Telegram HTML delivery.
   */
  formatJobAlert(job: {
    title: string;
    company?: string | null;
    location?: string | null;
    experienceLevel?: string | null;
    education?: string | null;
    summary?: string | null;
    sourceUrl?: string | null;
    matchScore?: number;
  }): { text: string; replyMarkup: SendMessageOptions["replyMarkup"] } {
    const esc = telegramClient.escapeHtml.bind(telegramClient);
    const formattedLoc = formatLocationLabel(job.location);
    const formattedExp = formatExperienceLabel(job.experienceLevel);

    const lines = [
      `🆕 <b>New Job Match</b>`,
      `<b>${esc(job.title)}</b>${job.company ? ` — ${esc(job.company)}` : ""}`,
      "",
      formattedLoc ? `📍 <b>Location:</b> ${esc(formattedLoc)}` : null,
      formattedExp ? `💼 <b>Level:</b> ${esc(formattedExp)}` : null,
      job.education ? `🎓 <b>Education:</b> ${esc(job.education)}` : null,
      job.matchScore ? `⭐ <b>Match:</b> ${job.matchScore}%` : null,
      "",
      job.summary ? `<i>${esc(job.summary.slice(0, 180))}</i>` : null,
    ].filter(Boolean);

    const buttons: Array<{ text: string; url?: string; callback_data?: string }> = [];
    if (job.sourceUrl) {
      buttons.push({ text: "🔗 View & Apply", url: job.sourceUrl });
    }

    return {
      text: lines.join("\n"),
      replyMarkup: buttons.length > 0 ? { inline_keyboard: [buttons] } : undefined,
    };
  }
}

export const telegramBotService = new TelegramBotService();
