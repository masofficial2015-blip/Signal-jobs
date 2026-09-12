/**
 * Job browsing service — fetches and filters jobs relevant to a user's preferences.
 * Called by the Telegram handler layer; database access isolated here.
 *
 * Performance notes:
 *  - getRelevantJobs results are cached per preference fingerprint for 5 minutes.
 *    This eliminates repeated DB queries when a user pages through results — each
 *    "Next →" press hits the cache instead of re-querying the database.
 *  - Cache is module-level (process lifetime). On Railway single-instance this is
 *    effectively a fast in-memory cache. Cache auto-expires entries after TTL.
 *  - The query uses status="PUBLISHED" which now has an index, limiting the scan
 *    scope to only active jobs regardless of total table size.
 */

import { db } from "@/lib/db";

export interface JobBrowseItem {
  id: string;
  title: string;
  company: string | null;
  location: string | null;
  experienceLevel: string | null;
  category: string | null;
  summary: string | null;
  applicationUrl: string | null;
  sourceUrl: string | null;
}

// ── Simple in-memory TTL cache ─────────────────────────────────────────────────

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
  jobs: JobBrowseItem[];
  expiresAt: number;
}

const browseCache = new Map<string, CacheEntry>();

function makeCacheKey(preferences: {
  categories: string[];
  experienceLevels: string[];
  locations: string[];
}): string {
  // Sort for stable key regardless of insertion order
  const cats = [...preferences.categories].sort().join(",");
  const exps = [...preferences.experienceLevels].sort().join(",");
  const locs = [...preferences.locations].sort().join(",");
  return `${cats}|${exps}|${locs}`;
}

function getFromCache(key: string): JobBrowseItem[] | null {
  const entry = browseCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    browseCache.delete(key);
    return null;
  }
  return entry.jobs;
}

function setInCache(key: string, jobs: JobBrowseItem[]): void {
  browseCache.set(key, { jobs, expiresAt: Date.now() + CACHE_TTL_MS });
  // Prevent unbounded growth — evict oldest entries when cache > 200 keys
  if (browseCache.size > 200) {
    const firstKey = browseCache.keys().next().value;
    if (firstKey !== undefined) browseCache.delete(firstKey);
  }
}

/** Invalidate all cached browse results (call after a new job is published). */
export function invalidateBrowseCache(): void {
  browseCache.clear();
}

// ── Service ────────────────────────────────────────────────────────────────────

export class JobBrowseService {
  /**
   * Returns up to `limit` recently published jobs that partially match
   * the user's preferences. Excludes jobs whose deadline has passed.
   *
   * Results are cached for CACHE_TTL_MS per unique preference combination.
   */
  async getRelevantJobs(preferences: {
    categories: string[];
    experienceLevels: string[];
    locations: string[];
  }, limit = 5): Promise<JobBrowseItem[]> {
    const cacheKey = makeCacheKey(preferences);
    const cached = getFromCache(cacheKey);
    if (cached) return cached;

    const jobs = await this.queryJobs(preferences, limit);
    setInCache(cacheKey, jobs);
    return jobs;
  }

  private async queryJobs(preferences: {
    categories: string[];
    experienceLevels: string[];
    locations: string[];
  }, limit: number): Promise<JobBrowseItem[]> {
    const now = new Date();
    const activeDeadlineCondition = {
      OR: [
        { deadline: null },
        { deadline: { gte: now } },
      ],
    };

    const hasFilters =
      preferences.categories.length > 0 ||
      preferences.experienceLevels.length > 0 ||
      preferences.locations.length > 0;

    if (!hasFilters) {
      return this.getRecentJobs(limit);
    }

    const orConditions: object[] = [];

    if (preferences.categories.length > 0) {
      orConditions.push(...preferences.categories.map((c) => ({
        category: { contains: c },
      })));
    }

    if (preferences.experienceLevels.length > 0) {
      orConditions.push(...preferences.experienceLevels.map((e) => ({
        experienceLevel: { contains: e },
      })));
    }

    if (preferences.locations.length > 0) {
      orConditions.push(...preferences.locations.map((l) => ({
        location: { contains: l },
      })));
    }

    const jobs = await db.job.findMany({
      where: {
        status: "PUBLISHED", // hits the @@index([status]) index
        AND: [
          activeDeadlineCondition,
          { OR: orConditions },
        ],
      },
      select: {
        id: true,
        title: true,
        company: true,
        location: true,
        experienceLevel: true,
        category: true,
        summary: true,
        applicationUrl: true,
        sourceUrl: true,
      },
      orderBy: { publishedAt: "desc" }, // hits the @@index([status, publishedAt]) index
      take: limit,
    });

    if (jobs.length === 0) {
      return this.getRecentJobs(limit);
    }

    return jobs;
  }

  async getRecentJobs(limit = 5): Promise<JobBrowseItem[]> {
    const now = new Date();
    return db.job.findMany({
      where: {
        status: "PUBLISHED",
        OR: [
          { deadline: null },
          { deadline: { gte: now } },
        ],
      },
      select: {
        id: true,
        title: true,
        company: true,
        location: true,
        experienceLevel: true,
        category: true,
        summary: true,
        applicationUrl: true,
        sourceUrl: true,
      },
      orderBy: { publishedAt: "desc" },
      take: limit,
    });
  }

  async getJobById(id: string): Promise<JobBrowseItem | null> {
    return db.job.findFirst({
      where: { id, status: "PUBLISHED" },
      select: {
        id: true,
        title: true,
        company: true,
        location: true,
        experienceLevel: true,
        category: true,
        summary: true,
        applicationUrl: true,
        sourceUrl: true,
      },
    });
  }
}

export const jobBrowseService = new JobBrowseService();
