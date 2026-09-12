/**
 * Telegram Bot API client — wraps the raw HTTP API.
 * All business logic lives in the handler layer, not here.
 */

import { env } from "@/lib/env";

export interface InlineKeyboardButton {
  text: string;
  url?: string;
  callback_data?: string;
}

export interface SendMessageOptions {
  chatId: string | number;
  text: string;
  parseMode?: "HTML" | "MarkdownV2";
  replyMarkup?: {
    inline_keyboard?: InlineKeyboardButton[][];
    remove_keyboard?: true;
    keyboard?: Array<Array<{ text: string }>>;
    one_time_keyboard?: boolean;
    resize_keyboard?: boolean;
  };
  disableWebPagePreview?: boolean;
}

export interface AnswerCallbackQueryOptions {
  callbackQueryId: string;
  text?: string;
  showAlert?: boolean;
}

export interface EditMessageOptions {
  chatId: string | number;
  messageId: number;
  text: string;
  parseMode?: "HTML" | "MarkdownV2";
  replyMarkup?: { inline_keyboard?: InlineKeyboardButton[][] };
}

export interface EditMessageReplyMarkupOptions {
  chatId: string | number;
  messageId: number;
  replyMarkup?: { inline_keyboard?: InlineKeyboardButton[][] };
}

export class TelegramApiClient {
  private readonly botToken: string;
  private readonly apiBase: string;
  private readonly isMock: boolean;

  constructor() {
    this.botToken = env.TELEGRAM_BOT_TOKEN;
    this.apiBase = `https://api.telegram.org/bot${this.botToken}`;
    this.isMock = !this.botToken || this.botToken === "mock_telegram_bot_token";
  }

  private async call<T = unknown>(method: string, body: Record<string, unknown>): Promise<T | null> {
    if (this.isMock) {
      console.log(`[Telegram Mock] ${method}:`, JSON.stringify(body).slice(0, 200));
      if (method === "sendMessage") {
        return { message_id: Math.floor(Math.random() * 100000) } as unknown as T;
      }
      return { ok: true } as unknown as T;
    }

    try {
      const res = await fetch(`${this.apiBase}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.ok) {
        console.error(`[Telegram API Error] ${method}:`, data.description);
        return null;
      }
      return data.result as T;
    } catch (err) {
      console.error(`[Telegram API Fetch Error] ${method}:`, err);
      return null;
    }
  }

  async sendMessage(options: SendMessageOptions): Promise<{ message_id?: number } | null> {
    return this.call("sendMessage", {
      chat_id: options.chatId,
      text: options.text,
      parse_mode: options.parseMode ?? "HTML",
      reply_markup: options.replyMarkup,
      disable_web_page_preview: options.disableWebPagePreview ?? false,
    });
  }

  async editMessageText(options: EditMessageOptions): Promise<unknown> {
    return this.call("editMessageText", {
      chat_id: options.chatId,
      message_id: options.messageId,
      text: options.text,
      parse_mode: options.parseMode ?? "HTML",
      reply_markup: options.replyMarkup,
    });
  }

  async editMessageReplyMarkup(options: EditMessageReplyMarkupOptions): Promise<unknown> {
    return this.call("editMessageReplyMarkup", {
      chat_id: options.chatId,
      message_id: options.messageId,
      reply_markup: options.replyMarkup,
    });
  }

  async answerCallbackQuery(options: AnswerCallbackQueryOptions): Promise<unknown> {
    return this.call("answerCallbackQuery", {
      callback_query_id: options.callbackQueryId,
      text: options.text,
      show_alert: options.showAlert ?? false,
    });
  }

  async deleteMessage(chatId: string | number, messageId: number): Promise<unknown> {
    return this.call("deleteMessage", {
      chat_id: chatId,
      message_id: messageId,
    });
  }

  escapeHtml(text: string | null | undefined): string {
    if (!text) return "";
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
}

export const telegramClient = new TelegramApiClient();
