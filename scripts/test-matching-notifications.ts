/**
 * Comprehensive verification script for:
 * 1. Deterministic Job-User Matching Engine (Score 0-100, explainability reasons, tiers)
 * 2. Notification System (Pending creation, sending, duplicate prevention, paused user filter, error handling)
 */

import { db } from "../src/lib/db";
import { jobMatchingEngine } from "../src/services/matching/matcher";
import { notificationDispatcher } from "../src/services/notifications/notifier";

async function runVerification() {
  console.log("=================================================");
  console.log("🚀 STARTING MATCHING ENGINE & NOTIFICATION TESTS");
  console.log("=================================================\n");

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
  // 1. MATCHING ENGINE UNIT TESTS
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("--- 1. Testing Deterministic Matching Engine ---");

  const sampleJob = {
    id: "job-test-101",
    title: "Software Developer",
    company: "ABC Tech PLC",
    category: "technology",
    profession: "Software Developer",
    experienceLevel: "Entry Level",
    location: "Addis Ababa",
    education: "Bachelor's Degree",
    skills: ["JavaScript", "React", "Node.js"],
  };

  // Test Case 1.1: Excellent matching user
  const matchingPrefs = {
    categories: ["technology"],
    professions: ["Software Developer"],
    locations: ["addis_ababa"],
    employmentTypes: ["full_time"],
    experienceLevels: ["entry_level"],
    keywords: ["react"],
    skills: ["JavaScript"],
  };

  const matchResult1 = jobMatchingEngine.calculateMatch(sampleJob, "user-1", matchingPrefs);
  console.log("User 1 Match Result:", { score: matchResult1.score, isMatch: matchResult1.isMatch, reasons: matchResult1.reasons });

  assert(matchResult1.isMatch === true, "Matching user isMatch === true");
  assert(matchResult1.score === 100, "Matching user score === 100");
  assert(matchResult1.reasons.length >= 1, "Match reasons returned");

  // Test Case 1.2: Unrelated user
  const unrelatedPrefs = {
    categories: ["healthcare"],
    professions: ["Registered Nurse"],
    locations: ["hawassa"],
    employmentTypes: ["part_time"],
    experienceLevels: ["senior_level"],
    keywords: ["nursing"],
    skills: ["Patient Care"],
  };

  const matchResult2 = jobMatchingEngine.calculateMatch(sampleJob, "user-2", unrelatedPrefs);
  console.log("User 2 Match Result:", { score: matchResult2.score, isMatch: matchResult2.isMatch, reasons: matchResult2.reasons });

  assert(matchResult2.score < 70, "Unrelated user receives low score (< 70)");
  assert(matchResult2.isMatch === false, "Unrelated user isMatch === false");

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. END-TO-END DATABASE & NOTIFICATION SYSTEM TESTS
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- 2. Testing Notification Generation & Dispatch ---");

  // Clean up test data if leftover
  await db.notification.deleteMany({});
  await db.job.deleteMany({ where: { id: sampleJob.id } });
  await db.user.deleteMany({});

  // Create test job in DB
  const dbJob = await db.job.create({
    data: {
      id: sampleJob.id,
      title: sampleJob.title,
      company: sampleJob.company,
      category: sampleJob.category,
      profession: sampleJob.profession,
      experienceLevel: sampleJob.experienceLevel,
      location: sampleJob.location,
      education: sampleJob.education,
      skills: JSON.stringify(sampleJob.skills),
      rawText: "Sample raw text for testing software developer job",
      status: "PUBLISHED",
      publishedAt: new Date(),
    },
  });

  // Create User 1: Matching active user
  const dbUser1 = await db.user.create({
    data: {
      telegramId: "test_tg_101",
      firstName: "Abebe",
      isActive: true,
      notificationsPaused: false,
      preference: {
        create: {
          categories: JSON.stringify(["technology"]),
          professions: JSON.stringify(["Software Developer"]),
          locations: JSON.stringify(["addis_ababa"]),
          experienceLevels: JSON.stringify(["entry_level"]),
        },
      },
    },
  });

  // Create User 2: Unrelated active user
  const dbUser2 = await db.user.create({
    data: {
      telegramId: "test_tg_102",
      firstName: "Kebede",
      isActive: true,
      notificationsPaused: false,
      preference: {
        create: {
          categories: JSON.stringify(["healthcare"]),
          professions: JSON.stringify(["Nurse"]),
          locations: JSON.stringify(["hawassa"]),
          experienceLevels: JSON.stringify(["senior_level"]),
        },
      },
    },
  });

  // Create User 3: Matching but PAUSED user
  const dbUser3 = await db.user.create({
    data: {
      telegramId: "test_tg_103",
      firstName: "Tigist",
      isActive: true,
      notificationsPaused: true, // PAUSED!
      preference: {
        create: {
          categories: JSON.stringify(["technology"]),
          professions: JSON.stringify(["Software Developer"]),
          locations: JSON.stringify(["addis_ababa"]),
          experienceLevels: JSON.stringify(["entry_level"]),
        },
      },
    },
  });

  // Test Step 2.1: Generate pending notifications
  const gen1 = await notificationDispatcher.generatePendingNotifications(dbJob.id);
  console.log("Notification Generation 1:", gen1);

  assert(gen1.totalEligibleUsers === 1, "Only 1 active non-paused eligible user found (User 1)");
  assert(gen1.pendingNotificationsCreated === 1, "Exactly 1 pending notification created in DB");

  // Verify DB record for User 1
  const notif1 = await db.notification.findUnique({
    where: { userId_jobId: { userId: dbUser1.id, jobId: dbJob.id } },
  });
  assert(notif1 !== null && notif1.status === "PENDING", "User 1 notification created with status PENDING");

  // Verify User 2 and User 3 got NO notification
  const notif2 = await db.notification.findUnique({
    where: { userId_jobId: { userId: dbUser2.id, jobId: dbJob.id } },
  });
  assert(notif2 === null, "Unrelated user (User 2) did NOT receive notification");

  const notif3 = await db.notification.findUnique({
    where: { userId_jobId: { userId: dbUser3.id, jobId: dbJob.id } },
  });
  assert(notif3 === null, "Paused user (User 3) did NOT receive notification");

  // Test Step 2.2: Duplicate Notification Prevention
  console.log("\n--- Testing Duplicate Notification Prevention ---");
  const gen2 = await notificationDispatcher.generatePendingNotifications(dbJob.id);
  console.log("Notification Generation 2 (re-run):", gen2);

  assert(gen2.pendingNotificationsCreated === 0, "Duplicate run created 0 new notifications");
  assert(gen2.skippedDuplicates === 1, "Duplicate run correctly skipped existing notification");

  // Test Step 2.3: Sending Pending Notifications & Error Handling
  console.log("\n--- Testing Sending Notifications & Error Resilience ---");
  const dispatch1 = await notificationDispatcher.sendPendingNotifications(dbJob.id);
  console.log("Dispatch Result:", dispatch1);

  assert(dispatch1.totalProcessed === 1, "Processed 1 pending notification");
  
  // Verify notification status updated in DB
  const updatedNotif1 = await db.notification.findUnique({
    where: { userId_jobId: { userId: dbUser1.id, jobId: dbJob.id } },
  });
  assert(updatedNotif1 !== null && (updatedNotif1.status === "SENT" || updatedNotif1.status === "FAILED"), "Notification status updated from PENDING to SENT/FAILED");

  // Cleanup test records from DB
  await db.notification.deleteMany({ where: { jobId: sampleJob.id } });
  await db.job.deleteMany({ where: { id: sampleJob.id } });
  await db.user.deleteMany({ where: { telegramId: { in: ["test_tg_101", "test_tg_102", "test_tg_103"] } } });

  console.log("\n=================================================");
  console.log(`📊 TEST SUMMARY: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log("=================================================\n");

  if (passedTests < totalTests) {
    process.exit(1);
  }
}

runVerification().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
