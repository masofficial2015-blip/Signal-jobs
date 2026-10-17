import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

/**
 * Signal Jobs — High-Performance Database Restoration Script
 *
 * Usage:
 *   $env:TARGET_DATABASE_URL="postgresql://postgres:pass@host:port/railway"
 *   npx tsx scripts/restore-railway-db.ts [optional_path_to_backup.json]
 */

function chunkArray<T>(array: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

async function main() {
  let connectionUrl = process.env.TARGET_DATABASE_URL || process.env.DATABASE_URL;

  if (!connectionUrl || connectionUrl.includes("dev.db") || connectionUrl.includes("localhost")) {
    console.error("\n❌ Error: Please provide the target Railway PostgreSQL connection URL.");
    console.error("Example:");
    console.error('  $env:TARGET_DATABASE_URL="postgresql://postgres:PASSWORD@HOST:PORT/railway"');
    console.error("  npx tsx scripts/restore-railway-db.ts\n");
    process.exit(1);
  }

  // Ensure SSL parameter is present for Railway TCP proxy
  if (connectionUrl.includes("railway") || connectionUrl.includes("rlwy.net")) {
    if (!connectionUrl.includes("sslmode")) {
      connectionUrl += (connectionUrl.includes("?") ? "&" : "?") + "sslmode=no-verify";
    }
  }

  // Find latest backup file if not specified in args
  let backupFile = process.argv[2];
  if (!backupFile) {
    const backupsDir = path.join(process.cwd(), "backups");
    if (!fs.existsSync(backupsDir)) {
      console.error("\n❌ Error: backups/ directory not found. Run backup first.");
      process.exit(1);
    }
    const files = fs
      .readdirSync(backupsDir)
      .filter((f) => f.startsWith("railway_backup_") && f.endsWith(".json"))
      .sort()
      .reverse();

    if (files.length === 0) {
      console.error("\n❌ Error: No backup files found in backups/ directory.");
      process.exit(1);
    }
    backupFile = path.join(backupsDir, files[0]);
  }

  console.log(`📄 Using backup file: ${backupFile}`);
  const rawData = fs.readFileSync(backupFile, "utf-8");
  const backup = JSON.parse(rawData);

  console.log("🔌 Connecting to target database...");
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: connectionUrl,
      },
    },
  });

  const BATCH_SIZE = 500;

  try {
    const { data } = backup;
    console.log("🚀 Starting data restoration (foreign-key topological order)...\n");

    // 1. Admin Users
    if (data.adminUsers?.length) {
      console.log(`  Restoring ${data.adminUsers.length} Admin Users...`);
      for (const chunk of chunkArray(data.adminUsers, BATCH_SIZE)) {
        await prisma.adminUser.createMany({
          data: chunk.map((item: any) => ({
            ...item,
            lastLoginAt: item.lastLoginAt ? new Date(item.lastLoginAt) : null,
            createdAt: new Date(item.createdAt),
            updatedAt: new Date(item.updatedAt),
          })),
          skipDuplicates: true,
        });
      }
    }

    // 2. Users
    if (data.users?.length) {
      console.log(`  Restoring ${data.users.length} Telegram Users...`);
      for (const chunk of chunkArray(data.users, BATCH_SIZE)) {
        await prisma.user.createMany({
          data: chunk.map((item: any) => ({
            ...item,
            createdAt: new Date(item.createdAt),
            updatedAt: new Date(item.updatedAt),
          })),
          skipDuplicates: true,
        });
      }
    }

    // 3. User Preferences
    if (data.userPreferences?.length) {
      console.log(`  Restoring ${data.userPreferences.length} User Preferences...`);
      for (const chunk of chunkArray(data.userPreferences, BATCH_SIZE)) {
        await prisma.userPreference.createMany({
          data: chunk.map((item: any) => ({
            ...item,
            createdAt: new Date(item.createdAt),
            updatedAt: new Date(item.updatedAt),
          })),
          skipDuplicates: true,
        });
      }
    }

    // 4. Jobs
    if (data.jobs?.length) {
      console.log(`  Restoring ${data.jobs.length} Jobs...`);
      for (const chunk of chunkArray(data.jobs, BATCH_SIZE)) {
        await prisma.job.createMany({
          data: chunk.map((item: any) => ({
            ...item,
            deadline: item.deadline ? new Date(item.deadline) : null,
            publishedAt: item.publishedAt ? new Date(item.publishedAt) : null,
            expiredAt: item.expiredAt ? new Date(item.expiredAt) : null,
            createdAt: new Date(item.createdAt),
            updatedAt: new Date(item.updatedAt),
          })),
          skipDuplicates: true,
        });
      }
    }

    // 5. Saved Jobs
    if (data.savedJobs?.length) {
      console.log(`  Restoring ${data.savedJobs.length} Saved Jobs...`);
      for (const chunk of chunkArray(data.savedJobs, BATCH_SIZE)) {
        await prisma.savedJob.createMany({
          data: chunk.map((item: any) => ({
            ...item,
            createdAt: new Date(item.createdAt),
          })),
          skipDuplicates: true,
        });
      }
    }

    // 6. Ignored Jobs
    if (data.ignoredJobs?.length) {
      console.log(`  Restoring ${data.ignoredJobs.length} Ignored Jobs...`);
      for (const chunk of chunkArray(data.ignoredJobs, BATCH_SIZE)) {
        await prisma.ignoredJob.createMany({
          data: chunk.map((item: any) => ({
            ...item,
            createdAt: new Date(item.createdAt),
          })),
          skipDuplicates: true,
        });
      }
    }

    // 7. Notifications
    if (data.notifications?.length) {
      console.log(`  Restoring ${data.notifications.length} Notifications in batches...`);
      for (const chunk of chunkArray(data.notifications, BATCH_SIZE)) {
        await prisma.notification.createMany({
          data: chunk.map((item: any) => ({
            ...item,
            sentAt: item.sentAt ? new Date(item.sentAt) : null,
            createdAt: new Date(item.createdAt),
            updatedAt: new Date(item.updatedAt),
          })),
          skipDuplicates: true,
        });
      }
    }

    // 8. User Job Interactions
    if (data.interactions?.length) {
      console.log(`  Restoring ${data.interactions.length} Interactions in batches...`);
      for (const chunk of chunkArray(data.interactions, BATCH_SIZE)) {
        await prisma.userJobInteraction.createMany({
          data: chunk.map((item: any) => ({
            ...item,
            createdAt: new Date(item.createdAt),
          })),
          skipDuplicates: true,
        });
      }
    }

    // 9. Admin Logs
    if (data.adminLogs?.length) {
      console.log(`  Restoring ${data.adminLogs.length} Admin Logs...`);
      for (const chunk of chunkArray(data.adminLogs, BATCH_SIZE)) {
        await prisma.adminLog.createMany({
          data: chunk.map((item: any) => ({
            ...item,
            createdAt: new Date(item.createdAt),
          })),
          skipDuplicates: true,
        });
      }
    }

    // Verification check
    const [userCount, jobCount, prefCount, notifCount] = await Promise.all([
      prisma.user.count(),
      prisma.job.count(),
      prisma.userPreference.count(),
      prisma.notification.count(),
    ]);

    console.log("\n==========================================");
    console.log("✅ RESTORATION COMPLETED SUCCESSFULLY!");
    console.log("==========================================");
    console.log(`  • Verified Users in New DB       : ${userCount}`);
    console.log(`  • Verified Preferences in New DB : ${prefCount}`);
    console.log(`  • Verified Jobs in New DB        : ${jobCount}`);
    console.log(`  • Verified Notifications in DB   : ${notifCount}`);
    console.log("==========================================\n");
  } catch (error) {
    console.error("\n❌ Restoration failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
