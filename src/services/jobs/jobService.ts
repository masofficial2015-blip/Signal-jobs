import { db } from "@/lib/db";
import { ExtractedJobData } from "@/lib/types";
import { notificationDispatcher } from "../notifications/notifier";

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
   */
  async publishJob(jobId: string) {
    const job = await db.job.update({
      where: { id: jobId },
      data: {
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
    });

    // Asynchronously dispatch notifications
    const dispatchResult = await notificationDispatcher.dispatchJobNotifications(jobId);

    return { job, dispatchResult };
  }

  /**
   * Simple duplicate detection based on normalized title and company.
   */
  async findPotentialDuplicates(title: string, company?: string | null) {
    if (!company) {
      return db.job.findMany({
        where: {
          title: { contains: title.trim() },
        },
        take: 3,
      });
    }

    return db.job.findMany({
      where: {
        title: { contains: title.trim() },
        company: { contains: company.trim() },
      },
      take: 3,
    });
  }
}

export const jobService = new JobService();
