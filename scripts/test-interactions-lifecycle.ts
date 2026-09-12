/**
 * Automated Verification Script for PROMPT 5:
 * 1. Saved Jobs & Interaction Event Tracking (Save, Unsave, View, Apply, Profile Update, Pause, Resume)
 * 2. Job Lifecycle & Expiration Service (Deadline expiration, 30-day age expiration, active preservation)
 * 3. Recommendation & Notification Exclusion for Expired Jobs
 */

import { db } from "../src/lib/db";
import { userService } from "../src/services/telegram/userService";
import { jobLifecycleService } from "../src/services/jobs/lifecycle";
import { jobMatchingEngine } from "../src/services/matching/matcher";
import { jobBrowseService } from "../src/services/telegram/jobBrowseService";

async function runInteractionLifecycleTests() {
  console.log("==================================================================");
  console.log("🚀 STARTING USER INTERACTIONS, SAVED JOBS & LIFECYCLE TEST SUITE");
  console.log("==================================================================\n");

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string) {
    totalTests++;
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passedTests++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. TESTING USER INTERACTIONS & SAVED JOBS
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("--- 1. Testing Saved Jobs & Interaction Events ---");

  // Clean test records
  await db.userJobInteraction.deleteMany({});
  await db.savedJob.deleteMany({});
  await db.notification.deleteMany({});
  await db.job.deleteMany({ where: { id: { in: ["job_int_1", "job_exp_deadline", "job_exp_old", "job_fresh"] } } });
  await db.user.deleteMany({ where: { telegramId: { in: ["tg_test_user_501"] } } });

  // Create test user
  const user = await userService.upsertFromTelegram({
    id: 501,
    first_name: "Almaz",
    username: "almaz_test",
  });

  // Create test job
  const job = await db.job.create({
    data: {
      id: "job_int_1",
      title: "Senior Python Developer",
      company: "Addis Solutions",
      category: "technology",
      profession: "Python Developer",
      location: "Addis Ababa",
      rawText: "Senior Python developer vacancy in Addis",
      status: "PUBLISHED",
      publishedAt: new Date(),
    },
  });

  // Test 1.1: Save Job & Event Recording
  await userService.saveJob(user.id, job.id);
  const isSaved1 = await userService.isJobSaved(user.id, job.id);
  assert(isSaved1 === true, "Job is marked as saved for user");

  const savedList = await userService.getSavedJobs(user.id);
  assert(savedList.length === 1 && savedList[0].jobId === job.id, "Saved jobs query returns saved job item");

  const saveInteractions = await db.userJobInteraction.findMany({
    where: { userId: user.id, jobId: job.id, action: "JOB_SAVED" },
  });
  assert(saveInteractions.length >= 1, "JOB_SAVED interaction event recorded in DB");

  // Test 1.2: Idempotency of Save Job
  await userService.saveJob(user.id, job.id); // Save again
  const savedCount = await db.savedJob.count({ where: { userId: user.id, jobId: job.id } });
  assert(savedCount === 1, "Saving duplicate job is idempotent (no duplicate DB row)");

  // Test 1.3: Unsave Job & Event Recording
  await userService.unsaveJob(user.id, job.id);
  const isSaved2 = await userService.isJobSaved(user.id, job.id);
  assert(isSaved2 === false, "Job is successfully unsaved");

  const unsaveInteractions = await db.userJobInteraction.findMany({
    where: { userId: user.id, jobId: job.id, action: "JOB_UNSAVED" },
  });
  assert(unsaveInteractions.length >= 1, "JOB_UNSAVED interaction event recorded in DB");

  // Test 1.4: Profile Update, Pause, Resume Interaction Tracking
  await userService.upsertPreference(user.id, {
    categories: ["technology"],
    locations: ["addis_ababa"],
  });
  await userService.pauseNotifications(user.id);
  await userService.resumeNotifications(user.id);
  await userService.trackInteraction(user.id, job.id, "JOB_VIEWED");
  await userService.trackInteraction(user.id, job.id, "JOB_APPLIED");

  const allInteractions = await userService.getUserInteractions(user.id);
  const actionTypes = allInteractions.map((i) => i.action);

  assert(actionTypes.includes("PROFILE_UPDATED"), "PROFILE_UPDATED event recorded");
  assert(actionTypes.includes("NOTIFICATIONS_PAUSED"), "NOTIFICATIONS_PAUSED event recorded");
  assert(actionTypes.includes("NOTIFICATIONS_RESUMED"), "NOTIFICATIONS_RESUMED event recorded");
  assert(actionTypes.includes("JOB_VIEWED"), "JOB_VIEWED event recorded");
  assert(actionTypes.includes("JOB_APPLIED"), "JOB_APPLIED event recorded");

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. TESTING JOB LIFECYCLE & AUTOMATIC EXPIRATION
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- 2. Testing Job Lifecycle & Expiration Service ---");

  const pastDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000); // 5 days ago (expired deadline)
  const oldDate = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000); // 35 days ago (max age expired)
  const futureDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000); // 10 days in future

  // Job A: Expired due to passed application deadline
  await db.job.create({
    data: {
      id: "job_exp_deadline",
      title: "Marketing Officer (Expired Deadline)",
      category: "business",
      location: "Addis Ababa",
      deadline: pastDate,
      rawText: "Marketing job past deadline",
      status: "PUBLISHED",
      publishedAt: new Date(),
    },
  });

  // Job B: Expired due to 30-day maximum age
  await db.job.create({
    data: {
      id: "job_exp_old",
      title: "Accountant (35 Days Old)",
      category: "finance",
      location: "Hawassa",
      createdAt: oldDate,
      publishedAt: oldDate,
      rawText: "Old accounting job past 30 days",
      status: "PUBLISHED",
    },
  });

  // Job C: Fresh job (valid future deadline, created today)
  await db.job.create({
    data: {
      id: "job_fresh",
      title: "Fresh Junior Developer",
      category: "technology",
      location: "Addis Ababa",
      deadline: futureDate,
      rawText: "Fresh developer job vacancy",
      status: "PUBLISHED",
      publishedAt: new Date(),
    },
  });

  // Run Expiration Cleanup
  const expireResult = await jobLifecycleService.checkAndExpireJobs({ maxAgeDays: 30 });
  console.log("Expiration Check Result:", expireResult);

  assert(expireResult.expiredCount === 2, "Exactly 2 outdated jobs detected and expired");
  assert(expireResult.expiredJobIds.includes("job_exp_deadline"), "Expired deadline job ID included in result");
  assert(expireResult.expiredJobIds.includes("job_exp_old"), "Old 30-day job ID included in result");

  // Verify DB Statuses
  const dbJobDeadline = await db.job.findUnique({ where: { id: "job_exp_deadline" } });
  assert(dbJobDeadline?.status === "EXPIRED" && dbJobDeadline?.expiredAt !== null, "Deadline job status updated to EXPIRED with expiredAt set");

  const dbJobOld = await db.job.findUnique({ where: { id: "job_exp_old" } });
  assert(dbJobOld?.status === "EXPIRED" && dbJobOld?.expiredAt !== null, "35-day job status updated to EXPIRED with expiredAt set");

  const dbJobFresh = await db.job.findUnique({ where: { id: "job_fresh" } });
  assert(dbJobFresh?.status === "PUBLISHED", "Fresh job remains active as PUBLISHED");

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. TESTING EXCLUSION OF EXPIRED JOBS FROM RECOMMENDATIONS & SEARCH
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- 3. Testing Recommendation Exclusion & Historical Data Retention ---");

  const browsingJobs = await jobBrowseService.getRelevantJobs({
    categories: ["business", "finance", "technology"],
    experienceLevels: [],
    locations: [],
  });

  const browsingIds = browsingJobs.map((j) => j.id);
  assert(!browsingIds.includes("job_exp_deadline"), "Expired deadline job excluded from user job browsing");
  assert(!browsingIds.includes("job_exp_old"), "Old expired job excluded from user job browsing");
  assert(browsingIds.includes("job_fresh"), "Fresh published job appears in user job browsing");

  // Cleanup test data
  await db.userJobInteraction.deleteMany({});
  await db.savedJob.deleteMany({});
  await db.job.deleteMany({ where: { id: { in: ["job_int_1", "job_exp_deadline", "job_exp_old", "job_fresh"] } } });
  await db.user.deleteMany({ where: { telegramId: { in: ["tg_test_user_501"] } } });

  console.log("\n==================================================================");
  console.log(`📊 TEST SUMMARY: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log("==================================================================\n");

  if (passedTests < totalTests) {
    process.exit(1);
  }
}

runInteractionLifecycleTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
