/**
 * Deterministic Job-User Matching Engine.
 * Matches jobs directly to users based on their active preferences:
 *   1. Category (supports multiple job categories and user preferences)
 *   2. Experience Level (supports multiple target experience levels e.g. 0-2 years)
 *   3. Location (supports specific cities, Remote, and "Any Location")
 *
 * 100% deterministic, zero hallucination, and instant.
 */

import { ParsedUserPreferences } from "@/lib/types";
import {
  JOB_CATEGORIES,
  EXPERIENCE_LEVELS,
  ETHIOPIAN_LOCATIONS,
  normalizeTaxonomyId,
  getParentCategory,
  getSubcategoriesForCategory,
  isSubcategory,
  TAXONOMY,
} from "@/lib/constants";

export interface MatchableJob {
  id: string;
  title: string;
  company?: string | null;
  category?: string | string[] | null;
  profession?: string | null;
  experienceLevel?: string | string[] | null;
  location?: string | null;
  employmentType?: string | null;
  education?: string | null;
  skills?: string | string[] | null;
  summary?: string | null;
}

export interface MatchBreakdown {
  category: boolean;
  experience: boolean;
  location: boolean;
}

export interface JobMatchCalculation {
  userId: string;
  jobId: string;
  score: number; // 100 for match, 0 for non-match
  isMatch: boolean;
  reasons: string[];
  breakdown: MatchBreakdown;
}

function parseTokens(raw: string | string[] | null | undefined): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((s) => String(s).toLowerCase().trim());
  const trimmed = raw.trim();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((s) => String(s).toLowerCase().trim());
      }
    } catch {
      // fallback
    }
  }
  return trimmed
    .split(",")
    .map((s) => s.replace(/["'[\]]/g, "").toLowerCase().trim())
    .filter(Boolean);
}

export class JobMatchingEngine {
  /**
   * Evaluates if a Job matches User Preferences.
   * User is notified if all active preferences (Category, Experience, Location) match.
   */
  calculateMatch(
    job: MatchableJob,
    userId: string,
    preferences: ParsedUserPreferences
  ): JobMatchCalculation {
    const norm = (str?: string | null) => (str || "").toLowerCase().trim();
    const reasons: string[] = [];

    // ── 1. Category Matching ─────────────────────────────────────────────────
    const userCats = (preferences.categories || []).filter(Boolean);
    const jobCats = parseTokens(job.category);
    let categoryMatch = false;

    if (userCats.length === 0) {
      // User hasn't filtered by category: match all
      categoryMatch = true;
    } else {
      const normalizedJobCats = jobCats.map((jc) => ({
        raw: jc,
        norm: normalizeTaxonomyId(jc),
        parent: getParentCategory(jc),
      }));

      categoryMatch = userCats.some((rawUserCat) => {
        const userNorm = normalizeTaxonomyId(rawUserCat);
        const userParent = getParentCategory(userNorm);
        const isUserSubcategory = !!userParent;

        if (isUserSubcategory) {
          // User chose a specific subcategory (e.g., civil_engineering)
          return normalizedJobCats.some((jc) => {
            // 1. Exact subcategory ID match
            if (jc.norm === userNorm) return true;

            // 2. Direct string/token match
            if (jc.raw === userNorm || jc.raw.includes(userNorm) || userNorm.includes(jc.raw)) return true;

            // 3. Match unspecialized general category posting (e.g. job is tagged ONLY as "engineering" without a conflicting subcategory)
            if (jc.norm === userParent.id) {
              const hasConflictingSubcategory = normalizedJobCats.some(
                (other) => other.parent?.id === userParent.id && other.norm !== userNorm
              );
              if (!hasConflictingSubcategory) return true;
            }

            return false;
          });
        } else {
          // User chose a top-level category (e.g., healthcare or engineering - matches all subcategories)
          const validSubIds = new Set(getSubcategoriesForCategory(userNorm).map((s) => s.id));
          return normalizedJobCats.some((jc) => {
            // 1. Direct top-level match
            if (jc.norm === userNorm) return true;

            // 2. Subcategory match (job is tagged with a subcategory of user's chosen category)
            if (validSubIds.has(jc.norm)) return true;
            if (jc.parent?.id === userNorm) return true;

            // 3. String contains / label match fallback
            if (jc.raw.includes(userNorm) || userNorm.includes(jc.raw)) return true;
            const catObj = TAXONOMY.find((c) => c.id === userNorm);
            if (catObj && (norm(catObj.label).includes(jc.raw) || jc.raw.includes(norm(catObj.label)))) {
              return true;
            }

            return false;
          });
        }
      });
    }

    if (categoryMatch && job.category) {
      reasons.push("Category matching");
    }

    // ── 2. Experience Level Matching (Multi-level support) ───────────────────
    const userExps = (preferences.experienceLevels || []).map((e) => norm(e));
    const jobExps = parseTokens(job.experienceLevel);
    let experienceMatch = false;

    if (userExps.length === 0) {
      // User accepts any experience level
      experienceMatch = true;
    } else {
      experienceMatch = userExps.some((userExp) => {
        return jobExps.some((jobExp) => {
          if (jobExp === userExp) return true;
          const cleanUser = userExp.replace(/_/g, " ");
          const cleanJob = jobExp.replace(/_/g, " ");
          if (cleanJob.includes(cleanUser) || cleanUser.includes(cleanJob)) return true;

          // Fresh grad / Entry level crossover support (e.g. 0-2 yrs)
          if (
            (cleanUser.includes("graduate") || cleanUser.includes("entry")) &&
            (cleanJob.includes("graduate") || cleanJob.includes("entry") || cleanJob.includes("junior") || cleanJob.includes("fresh"))
          ) {
            return true;
          }

          const expObj = EXPERIENCE_LEVELS.find((e) => e.id === userExp);
          if (expObj && (norm(expObj.label).includes(cleanJob) || cleanJob.includes(norm(expObj.label)))) {
            return true;
          }
          return false;
        });
      });
    }

    if (experienceMatch && job.experienceLevel) {
      reasons.push("Experience level matching");
    }

    // ── 3. Location Matching ─────────────────────────────────────────────────
    const userLocs = (preferences.locations || []).map((l) => norm(l));
    const jobLoc = norm(job.location);
    let locationMatch = false;

    if (userLocs.length === 0 || userLocs.some((l) => l === "any" || l === "anywhere")) {
      // User accepts anywhere in Ethiopia
      locationMatch = true;
    } else {
      const isRemoteJob = jobLoc.includes("remote");
      locationMatch = userLocs.some((userLoc) => {
        if (userLoc === "remote" && isRemoteJob) return true;
        if (isRemoteJob) return true; // Remote jobs are open to all locations
        if (jobLoc.includes(userLoc) || userLoc.includes(jobLoc)) return true;

        const locObj = ETHIOPIAN_LOCATIONS.find((l) => l.id === userLoc);
        if (locObj && (norm(locObj.label).includes(jobLoc) || jobLoc.includes(norm(locObj.label)))) {
          return true;
        }
        return false;
      });
    }

    if (locationMatch && job.location) {
      reasons.push(job.location);
    }

    // ── Final Decision ───────────────────────────────────────────────────────
    const isMatch = categoryMatch && experienceMatch && locationMatch;
    const score = isMatch ? 100 : 0;

    return {
      userId,
      jobId: job.id,
      score,
      isMatch,
      reasons: Array.from(new Set(reasons)),
      breakdown: {
        category: categoryMatch,
        experience: experienceMatch,
        location: locationMatch,
      },
    };
  }
}

export const jobMatchingEngine = new JobMatchingEngine();

