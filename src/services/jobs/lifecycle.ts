/**
 * Job Lifecycle & Expiration Service
 * Handles automatic job expiration based on application deadlines and maximum age.
 * Preserves historical interaction data and stops expired jobs from appearing in recommendations.
 */

import { db } from "@/lib/db";

export interface ExpirationResult {
  totalChecked: number;
  expiredCount: number;
  expiredJobIds: string[];
}

export class JobLifecycleService {
  /**
   * Checks published jobs for expired deadlines or max age (default: 30 days).
   * Marks them EXPIRED and records expiredAt timestamp.
   */
  async checkAndExpireJobs(options?: {
    maxAgeDays?: number;
    adminId?: string;
  }): Promise<ExpirationResult> {
    const maxAgeDays = options?.maxAgeDays ?? 30;
    const now = new Date();
    const maxAgeThreshold = new Date(now.getTime() - maxAgeDays * 24 * 60 * 60 * 1000);

    // Select only IDs — avoids loading full job objects into memory at scale.
    const jobsToExpire = await db.job.findMany({
      where: {
        status: "PUBLISHED",
        OR: [
          // Explicit deadline has passed
          { deadline: { lt: now } },
          // Job is too old (by publishedAt)
          { publishedAt: { lt: maxAgeThreshold } },
          // No publishedAt set — fall back to createdAt
          { AND: [{ publishedAt: null }, { createdAt: { lt: maxAgeThreshold } }] },
        ],
      },
      select: { id: true },
    });

    const expiredJobIds = jobsToExpire.map((j) => j.id);

    if (expiredJobIds.length > 0) {
      // Bulk update in a single query — no per-job loop
      await db.job.updateMany({
        where: { id: { in: expiredJobIds } },
        data: {
          status: "EXPIRED",
          expiredAt: now,
        },
      });

      // Log admin/system lifecycle action
      await db.adminLog.create({
        data: {
          adminId: options?.adminId ?? null,
          action: "EXPIRE_JOBS_CLEANUP",
          details: `Automatically expired ${expiredJobIds.length} outdated job listing(s). IDs: ${expiredJobIds.join(", ")}`,
        },
      });
    }

    return {
      totalChecked: expiredJobIds.length,
      expiredCount: expiredJobIds.length,
      expiredJobIds,
    };
  }

  /**
   * Manually marks an individual job as EXPIRED.
   */
  async expireJob(jobId: string, adminId?: string) {
    const updated = await db.job.update({
      where: { id: jobId },
      data: {
        status: "EXPIRED",
        expiredAt: new Date(),
      },
    });

    await db.adminLog.create({
      data: {
        adminId: adminId ?? null,
        action: "EXPIRE_SINGLE_JOB",
        details: `Manually expired Job ID: ${jobId} (${updated.title})`,
      },
    });

    return updated;
  }
}

export const jobLifecycleService = new JobLifecycleService();
