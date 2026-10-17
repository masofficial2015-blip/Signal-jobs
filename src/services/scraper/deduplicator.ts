import { db } from "@/lib/db";

/**
 * Normalizes text for comparison (lowercase, removes punctuation and extra whitespace)
 */
export function normalizeString(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .replace(/[^\w\s\u1200-\u137F]/g, "") // preserve alphanumeric and Ethiopic characters
    .replace(/\s+/g, " ")
    .trim();
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  reason?: string;
  existingJobId?: string;
}

export class JobDeduplicator {
  /**
   * Check if a raw post URL or article URL has already been processed.
   */
  async isUrlAlreadyProcessed(url: string): Promise<boolean> {
    if (!url) return false;
    const existing = await db.job.findFirst({
      where: {
        OR: [{ sourceUrl: url }, { applicationUrl: url }],
      },
      select: { id: true },
    });
    return !!existing;
  }

  /**
   * Checks if an extracted job matches an existing job in the database.
   */
  async checkJobDuplicate(
    title: string,
    company: string | null,
    sourceUrl: string | null
  ): Promise<DuplicateCheckResult> {
    // 1. Check exact source URL
    if (sourceUrl) {
      const byUrl = await db.job.findFirst({
        where: {
          OR: [{ sourceUrl }, { applicationUrl: sourceUrl }],
        },
        select: { id: true, title: true },
      });
      if (byUrl) {
        return {
          isDuplicate: true,
          reason: `Exact source URL already ingested (Job: ${byUrl.title})`,
          existingJobId: byUrl.id,
        };
      }
    }

    // 2. Check title + company match within the last 14 days
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const normTitle = normalizeString(title);
    const normCompany = normalizeString(company);

    if (normTitle.length < 5) {
      return { isDuplicate: false };
    }

    // Fetch recent jobs to compare
    const recentJobs = await db.job.findMany({
      where: {
        createdAt: { gte: fourteenDaysAgo },
      },
      select: { id: true, title: true, company: true },
      take: 100,
    });

    for (const job of recentJobs) {
      const existingTitle = normalizeString(job.title);
      const existingCompany = normalizeString(job.company);

      // Same title and same company (or both companies empty and title identical)
      if (
        existingTitle === normTitle &&
        (existingCompany === normCompany || (!normCompany && !existingCompany))
      ) {
        return {
          isDuplicate: true,
          reason: `Identical position & company posted recently (Job ID: ${job.id})`,
          existingJobId: job.id,
        };
      }
    }

    return { isDuplicate: false };
  }
}

export const jobDeduplicator = new JobDeduplicator();
