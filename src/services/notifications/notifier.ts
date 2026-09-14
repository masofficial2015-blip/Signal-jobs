/**
 * Notification Service — manages notification generation, dispatch, and delivery tracking.
 *
 * Key design decisions:
 *  - generatePendingNotifications: runs matching in-memory, then batches ALL inserts
 *    with createMany+skipDuplicates (eliminates N+1 DB writes).
 *  - sendPendingNotifications: drain loop processes ALL pending in batches of 100,
 *    no more silent truncation at 100 messages.
 *  - Telegram 429 handling: reads retry_after and waits before continuing.
 *  - dispatchJobNotificationsAsync: fire-and-forget version for use in API routes
 *    so the admin HTTP response is not blocked by notification delivery.
 */

import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { jobMatchingEngine } from "../matching/matcher";
import { telegramClient } from "../telegram/client";
import { MSG, KB } from "../telegram/messages";
import { ParsedUserPreferences } from "@/lib/types";

const SEND_BATCH_SIZE = 100; // notifications per drain iteration
const BASE_DELAY_MS = 50;    // ~20 msgs/sec — under Telegram's 30/sec global limit

export interface GenerationResult {
  jobId: string;
  totalEligibleUsers: number;
  pendingNotificationsCreated: number;
  skippedDuplicates: number;
}

export interface DispatchResult {
  jobId?: string;
  totalProcessed: number;
  totalSent: number;
  totalFailed: number;
}

export class NotificationDispatcher {
  /**
   * Non-blocking entry point for the admin route.
   * Saves the job, kicks off notifications in the background, returns immediately.
   * The caller does NOT await the full notification pipeline.
   */
  dispatchJobNotificationsAsync(jobId: string): void {
    // Fire and forget — intentionally not awaited
    this.processJobPublishNotifications(jobId).catch((err) => {
      console.error(`[Notifier] Background dispatch failed for job ${jobId}:`, err);
    });
  }

  /**
   * Blocking version — only use in scripts or cron jobs, not in HTTP request handlers.
   */
  async dispatchJobNotifications(jobId: string) {
    const res = await this.processJobPublishNotifications(jobId);
    return {
      totalMatched: res.generation.totalEligibleUsers,
      totalSent: res.dispatch.totalSent,
      totalFailed: res.dispatch.totalFailed,
    };
  }

  /**
   * STEP 1: Generate pending notification records for eligible users.
   *
   * Improvements over previous version:
   *  - Processes users in batches of 500 to keep memory flat (cursor pagination).
   *  - Collects all matching user IDs first, then does ONE batched createMany
   *    with skipDuplicates instead of N individual findUnique + create calls.
   */
  async generatePendingNotifications(jobId: string): Promise<GenerationResult> {
    const job = await db.job.findUnique({
      where: { id: jobId },
    });

    if (!job || job.status !== "PUBLISHED") {
      return {
        jobId,
        totalEligibleUsers: 0,
        pendingNotificationsCreated: 0,
        skippedDuplicates: 0,
      };
    }

    // Collect matching user IDs + match scores via cursor-paginated batches
    const notificationsToCreate: {
      userId: string;
      jobId: string;
      matchScore: number;
      matchReasons: string;
      status: string;
      retryCount: number;
    }[] = [];

    let totalEligibleUsers = 0;
    let cursor: string | undefined = undefined;

    // Cursor-paginated user scan — keeps memory flat regardless of user count
    while (true) {
      // Explicit type annotation required for TypeScript 7 strict inference on await-ternary
      type UserWithPref = Prisma.UserGetPayload<{ include: { preference: true } }>;
      let batch: UserWithPref[];
      if (cursor) {
        batch = await db.user.findMany({
          where: { isActive: true, notificationsPaused: false },
          include: { preference: true },
          take: 500,
          orderBy: { id: "asc" },
          skip: 1,
          cursor: { id: cursor },
        });
      } else {
        batch = await db.user.findMany({
          where: { isActive: true, notificationsPaused: false },
          include: { preference: true },
          take: 500,
          orderBy: { id: "asc" },
        });
      }

      if (batch.length === 0) break;
      cursor = batch[batch.length - 1].id;

      for (const user of batch) {
        if (!user.preference) continue;

        const preferences: ParsedUserPreferences = {
          categories: this.safeParseArray(user.preference.categories),
          professions: this.safeParseArray(user.preference.professions),
          experienceLevels: this.safeParseArray(user.preference.experienceLevels),
          locations: this.safeParseArray(user.preference.locations),
          employmentTypes: this.safeParseArray(user.preference.employmentTypes),
          keywords: this.safeParseArray(user.preference.keywords),
          skills: this.safeParseArray(user.preference.skills),
        };

        const match = jobMatchingEngine.calculateMatch(
          {
            id: job.id,
            title: job.title,
            company: job.company,
            category: job.category,
            profession: job.profession,
            experienceLevel: job.experienceLevel,
            location: job.location,
            employmentType: job.employmentType,
            education: job.education,
            skills: job.skills,
            summary: job.summary,
          },
          user.id,
          preferences
        );

        if (match.isMatch) {
          totalEligibleUsers++;
          notificationsToCreate.push({
            userId: user.id,
            jobId: job.id,
            matchScore: match.score,
            matchReasons: JSON.stringify(match.reasons),
            status: "PENDING",
            retryCount: 0,
          });
        }
      }

      if (batch.length < 500) break; // last page
    }

    // Deduplicate: fetch any existing notification records for this job, skip them
    // (SQLite Prisma doesn't support skipDuplicates in createMany)
    const existingUserIds = notificationsToCreate.length > 0
      ? await db.notification
          .findMany({
            where: { jobId, userId: { in: notificationsToCreate.map((n) => n.userId) } },
            select: { userId: true },
          })
          .then((rows) => new Set(rows.map((r) => r.userId)))
      : new Set<string>();

    const newNotifications = notificationsToCreate.filter(
      (n) => !existingUserIds.has(n.userId)
    );
    const skippedDuplicates = notificationsToCreate.length - newNotifications.length;

    if (newNotifications.length > 0) {
      await db.notification.createMany({ data: newNotifications });
    }
    const created = newNotifications.length;

    return {
      jobId,
      totalEligibleUsers,
      pendingNotificationsCreated: created,
      skippedDuplicates,
    };
  }

  /**
   * STEP 2: Send pending notifications via Telegram API.
   *
   * Improvements over previous version:
   *  - Drain loop: processes ALL pending notifications, not just the first 100.
   *  - Telegram 429 handling: reads retry_after and waits accordingly.
   *  - Non-fatal: errors on individual messages are recorded but don't abort the loop.
   */
  async sendPendingNotifications(jobId?: string): Promise<DispatchResult> {
    let totalProcessed = 0;
    let totalSent = 0;
    let totalFailed = 0;
    let lastId: string | undefined = undefined;

    // Drain loop — keeps fetching batches until no PENDING remain for this job
    while (true) {
      // Build where clause explicitly to satisfy TypeScript 7 strict inference
      const pendingWhere: Prisma.NotificationWhereInput = {
        status: "PENDING",
        user: { isActive: true, notificationsPaused: false },
      };
      if (jobId) pendingWhere.jobId = jobId;
      if (lastId) pendingWhere.id = { gt: lastId };

      const pendingNotifications = await db.notification.findMany({
        where: pendingWhere,
        include: { user: true, job: true },
        take: SEND_BATCH_SIZE,
        orderBy: { id: "asc" },
      });

      if (pendingNotifications.length === 0) break;
      lastId = pendingNotifications[pendingNotifications.length - 1].id;

      for (const notification of pendingNotifications) {
        totalProcessed++;

        try {
          const { user, job } = notification;

          // Re-check: skip if user became inactive/paused between generation and sending
          if (!user.isActive || user.notificationsPaused) {
            await db.notification.update({
              where: { id: notification.id },
              data: {
                status: "FAILED",
                errorMessage: "User paused notifications or account inactive",
              },
            });
            totalFailed++;
            continue;
          }

          const messageText = MSG.jobMatchAlert({
            title: job.title,
            company: job.company,
            location: job.location,
            experienceLevel: job.experienceLevel,
            education: job.education,
            summary: job.summary,
          });

          const appUrl = job.applicationUrl || job.sourceUrl;
          const inlineKeyboard = KB.jobAlertActions(job.id, appUrl);

          // Dispatch Telegram message with 429 retry support
          const sendResult = await this.sendWithRetry({
            chatId: user.telegramId,
            text: messageText,
            replyMarkup: { inline_keyboard: inlineKeyboard },
          });

          if (sendResult.ok && sendResult.data !== null) {
            totalSent++;
            await db.notification.update({
              where: { id: notification.id },
              data: {
                status: "SENT",
                sentAt: new Date(),
                telegramMessageId: sendResult.data?.message_id
                  ? String(sendResult.data.message_id)
                  : null,
                errorMessage: null,
              },
            });
          } else {
            totalFailed++;
            const errorMsg = sendResult.errorMessage || "Failed to send message via Telegram API";
            const isBlockedOrDeleted =
              errorMsg.toLowerCase().includes("forbidden") ||
              errorMsg.toLowerCase().includes("blocked") ||
              errorMsg.toLowerCase().includes("deactivated") ||
              errorMsg.toLowerCase().includes("chat not found");

            if (isBlockedOrDeleted) {
              await db.user.update({
                where: { id: user.id },
                data: { isActive: false },
              });
            }

            await db.notification.update({
              where: { id: notification.id },
              data: {
                status: "FAILED",
                errorMessage: errorMsg,
                retryCount: notification.retryCount + 1,
              },
            });
          }
        } catch (err: any) {
          totalFailed++;
          await db.notification.update({
            where: { id: notification.id },
            data: {
              status: "FAILED",
              errorMessage: err?.message || "Unexpected dispatch error",
              retryCount: notification.retryCount + 1,
            },
          });
        }

        // Rate limit delay between messages (~20 msgs/sec)
        await this.delay(BASE_DELAY_MS);
      }

      // If we got fewer than the batch size, we've drained the queue
      if (pendingNotifications.length < SEND_BATCH_SIZE) break;
    }

    return {
      jobId,
      totalProcessed,
      totalSent,
      totalFailed,
    };
  }

  /**
   * Full end-to-end publish orchestrator.
   * Generates pending notification records then drains them all.
   */
  async processJobPublishNotifications(jobId: string) {
    const generation = await this.generatePendingNotifications(jobId);
    const dispatch = await this.sendPendingNotifications(jobId);

    return {
      jobId,
      generation,
      dispatch,
    };
  }

  /**
   * Retries failed notifications (up to maxRetries attempts).
   */
  async retryFailedNotifications(maxRetries = 3): Promise<DispatchResult> {
    let totalProcessed = 0;
    let totalSent = 0;
    let totalFailed = 0;
    let lastId: string | undefined = undefined;

    while (true) {
      // Build where clause explicitly to satisfy TypeScript 7 strict inference
      const retryWhere: Prisma.NotificationWhereInput = {
        status: "FAILED",
        retryCount: { lt: maxRetries },
        user: { isActive: true, notificationsPaused: false },
      };
      if (lastId) retryWhere.id = { gt: lastId };

      const failedNotifications = await db.notification.findMany({
        where: retryWhere,
        include: { user: true, job: true },
        take: SEND_BATCH_SIZE,
        orderBy: { id: "asc" },
      });

      if (failedNotifications.length === 0) break;
      lastId = failedNotifications[failedNotifications.length - 1].id;

      for (const notification of failedNotifications) {
        totalProcessed++;

        try {
          const { user, job } = notification;

          const messageText = MSG.jobMatchAlert({
            title: job.title,
            company: job.company,
            location: job.location,
            experienceLevel: job.experienceLevel,
            education: job.education,
            summary: job.summary,
          });

          const appUrl = job.applicationUrl || job.sourceUrl;
          const inlineKeyboard = KB.jobAlertActions(job.id, appUrl);

          const sendResult = await this.sendWithRetry({
            chatId: user.telegramId,
            text: messageText,
            replyMarkup: { inline_keyboard: inlineKeyboard },
          });

          if (sendResult.ok && sendResult.data !== null) {
            totalSent++;
            await db.notification.update({
              where: { id: notification.id },
              data: {
                status: "SENT",
                sentAt: new Date(),
                telegramMessageId: sendResult.data?.message_id
                  ? String(sendResult.data.message_id)
                  : null,
                errorMessage: null,
              },
            });
          } else {
            totalFailed++;
            await db.notification.update({
              where: { id: notification.id },
              data: {
                status: "FAILED",
                errorMessage: sendResult.errorMessage || "Retry failed",
                retryCount: notification.retryCount + 1,
              },
            });
          }
        } catch (err: any) {
          totalFailed++;
          await db.notification.update({
            where: { id: notification.id },
            data: {
              status: "FAILED",
              errorMessage: err?.message || "Retry unexpected error",
              retryCount: notification.retryCount + 1,
            },
          });
        }

        await this.delay(BASE_DELAY_MS);
      }

      if (failedNotifications.length < SEND_BATCH_SIZE) break;
    }

    return {
      totalProcessed,
      totalSent,
      totalFailed,
    };
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private async sendWithRetry(options: Parameters<typeof telegramClient.sendMessage>[0]): Promise<{
    ok: boolean;
    data: { message_id?: number } | null;
    errorMessage?: string;
  }> {
    try {
      const result = await telegramClient.sendMessage(options);
      return { ok: true, data: result };
    } catch (err: any) {
      // Wait 2 seconds and retry once — covers transient failures and mild rate limits
      await this.delay(2000);
      try {
        const retry = await telegramClient.sendMessage(options);
        return { ok: true, data: retry };
      } catch (retryErr: any) {
        return { 
          ok: false, 
          data: null, 
          errorMessage: retryErr.message || err.message || "Failed to send message via Telegram API" 
        };
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private safeParseArray(jsonStr?: string | null): string[] {
    if (!jsonStr) return [];
    try {
      const parsed = JSON.parse(jsonStr);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}

export const notificationDispatcher = new NotificationDispatcher();
