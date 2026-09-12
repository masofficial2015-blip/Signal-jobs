/**
 * User Service — all database operations relating to Telegram users, preferences,
 * saved jobs, and user interaction analytics.
 */

import { db } from "@/lib/db";

export interface TelegramFromUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
}

export interface PreferenceUpdate {
  categories?: string[];
  professions?: string[];
  locations?: string[];
  employmentTypes?: string[];
  experienceLevels?: string[];
  keywords?: string[];
  skills?: string[];
}

export class UserService {
  /**
   * Finds or creates a user from Telegram's "from" object.
   * Safe to call on every message — idempotent.
   */
  async upsertFromTelegram(from: TelegramFromUser) {
    return db.user.upsert({
      where: { telegramId: String(from.id) },
      update: {
        telegramUsername: from.username ?? null,
        firstName: from.first_name ?? null,
        lastName: from.last_name ?? null,
      },
      create: {
        telegramId: String(from.id),
        telegramUsername: from.username ?? null,
        firstName: from.first_name ?? null,
        lastName: from.last_name ?? null,
        isActive: true,
        notificationsPaused: false,
      },
      include: { preference: true },
    });
  }

  async getByTelegramId(telegramId: string) {
    return db.user.findUnique({
      where: { telegramId },
      include: { preference: true },
    });
  }

  async getPreference(userId: string) {
    return db.userPreference.findUnique({ where: { userId } });
  }

  /**
   * Saves or updates the user's preference fields and logs interaction.
   * Partial updates are supported — only supplied fields are overwritten.
   */
  async upsertPreference(userId: string, data: PreferenceUpdate) {
    const serialize = (arr?: string[]) => (arr !== undefined ? JSON.stringify(arr) : undefined);

    const updatePayload: Record<string, string> = {};
    if (data.categories !== undefined) updatePayload.categories = serialize(data.categories)!;
    if (data.professions !== undefined) updatePayload.professions = serialize(data.professions)!;
    if (data.locations !== undefined) updatePayload.locations = serialize(data.locations)!;
    if (data.employmentTypes !== undefined) updatePayload.employmentTypes = serialize(data.employmentTypes)!;
    if (data.experienceLevels !== undefined) updatePayload.experienceLevels = serialize(data.experienceLevels)!;
    if (data.keywords !== undefined) updatePayload.keywords = serialize(data.keywords)!;
    if (data.skills !== undefined) updatePayload.skills = serialize(data.skills)!;

    const result = await db.userPreference.upsert({
      where: { userId },
      update: updatePayload,
      create: {
        userId,
        categories: serialize(data.categories) ?? "[]",
        professions: serialize(data.professions) ?? "[]",
        locations: serialize(data.locations) ?? "[]",
        employmentTypes: serialize(data.employmentTypes) ?? "[]",
        experienceLevels: serialize(data.experienceLevels) ?? "[]",
        keywords: serialize(data.keywords) ?? "[]",
        skills: serialize(data.skills) ?? "[]",
      },
    });

    // Record interaction
    await this.trackInteraction(userId, null, "PROFILE_UPDATED", {
      updatedFields: Object.keys(data),
    });

    return result;
  }

  async pauseNotifications(userId: string) {
    const updated = await db.user.update({
      where: { id: userId },
      data: { notificationsPaused: true },
    });

    await this.trackInteraction(userId, null, "NOTIFICATIONS_PAUSED");
    return updated;
  }

  async resumeNotifications(userId: string) {
    const updated = await db.user.update({
      where: { id: userId },
      data: { notificationsPaused: false },
    });

    await this.trackInteraction(userId, null, "NOTIFICATIONS_RESUMED");
    return updated;
  }

  // ── Saved Jobs ─────────────────────────────────────────────────────────────

  async saveJob(userId: string, jobId: string) {
    const saved = await db.savedJob.upsert({
      where: { userId_jobId: { userId, jobId } },
      update: {},
      create: { userId, jobId },
    });

    await this.trackInteraction(userId, jobId, "JOB_SAVED");
    return saved;
  }

  async unsaveJob(userId: string, jobId: string) {
    const deleted = await db.savedJob.deleteMany({
      where: { userId, jobId },
    });

    await this.trackInteraction(userId, jobId, "JOB_UNSAVED");
    return deleted;
  }

  async isJobSaved(userId: string, jobId: string): Promise<boolean> {
    const existing = await db.savedJob.findUnique({
      where: { userId_jobId: { userId, jobId } },
    });
    return !!existing;
  }

  async getSavedJobs(userId: string) {
    return db.savedJob.findMany({
      where: { userId },
      include: { job: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
  }

  // ── User Interaction Analytics ──────────────────────────────────────────────

  /**
   * Tracks user interaction events idempotently in database.
   * Actions: JOB_VIEWED, JOB_SAVED, JOB_UNSAVED, JOB_APPLIED, PROFILE_UPDATED,
   * NOTIFICATIONS_PAUSED, NOTIFICATIONS_RESUMED, NOTIFICATION_SENT
   */
  async trackInteraction(
    userId: string,
    jobId: string | null,
    action: string,
    metadata?: Record<string, any>
  ) {
    try {
      return await db.userJobInteraction.create({
        data: {
          userId,
          jobId: jobId || undefined,
          action,
          metadata: metadata ? JSON.stringify(metadata) : null,
        },
      });
    } catch (err) {
      console.error("Failed to track user interaction:", err);
      return null;
    }
  }

  async getUserInteractions(userId: string, limit = 50) {
    return db.userJobInteraction.findMany({
      where: { userId },
      include: { job: true },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  /**
   * Parses a JSON preference array field safely.
   */
  parseArray(jsonStr: string | undefined | null): string[] {
    if (!jsonStr) return [];
    try {
      const parsed = JSON.parse(jsonStr);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}

export const userService = new UserService();
