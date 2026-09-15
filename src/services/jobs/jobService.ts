import { db } from "@/lib/db";
import { ExtractedJobData } from "@/lib/types";
import { notificationDispatcher } from "../notifications/notifier";
import { invalidateBrowseCache } from "../telegram/jobBrowseService";

export class JobService {
  /**
   * Saves a raw or AI-extracted job as DRAFT.
   */
  async createJobFromExtraction(rawText: string, extracted: ExtractedJobData) {
    return db.job.create({
      data: {
        title: extracted.title,
        company: extracted.company,
        location: extracted.location,
        category: extracted.category,
        employmentType: extracted.employmentType,
        experienceLevel: extracted.experienceLevel,
        education: extracted.education,
        skills: JSON.stringify(extracted.skills || []),
        summary: extracted.summary,
        sourceUrl: extracted.sourceUrl,
        deadline: extracted.deadline ? new Date(extracted.deadline) : null,
        rawText,
        status: "DRAFT",
      },
    });
  }

  /**
   * Publishes a reviewed job and triggers notifications.
   *
   * Uses dispatchJobNotificationsAsync (fire-and-forget) so the caller
   * is NOT blocked while 100+ Telegram messages are sent. The notification
   * pipeline continues in the background after this method returns.
   */
  async publishJob(jobId: string) {
    const job = await db.job.update({
      where: { id: jobId },
      data: {
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
    });

    // Invalidate the bot browse cache so the new job is immediately visible
    invalidateBrowseCache();

    // Non-blocking: returns immediately, notifications send in background
    notificationDispatcher.dispatchJobNotificationsAsync(jobId);

    return { job };
  }

  /**
   * Simple duplicate detection based on normalized title and company.
   * Uses case-insensitive matching to avoid missing duplicates with different casing.
   */
  async findPotentialDuplicates(title: string, company?: string | null) {
    if (!company) {
      return db.job.findMany({
        where: {
          title: { contains: title.trim(), mode: "insensitive" },
        },
        take: 3,
      });
    }

    return db.job.findMany({
      where: {
        title: { contains: title.trim(), mode: "insensitive" },
        company: { contains: company.trim(), mode: "insensitive" },
      },
      take: 3,
    });
  }
}

export const jobService = new JobService();
