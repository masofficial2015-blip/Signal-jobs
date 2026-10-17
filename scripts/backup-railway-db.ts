import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

/**
 * Signal Jobs — Database Backup Script
 *
 * Usage:
 *   $env:SOURCE_DATABASE_URL="postgresql://postgres:pass@host:port/railway"
 *   npx tsx scripts/backup-railway-db.ts
 */
async function main() {
  let connectionUrl = process.env.SOURCE_DATABASE_URL || process.env.DATABASE_URL;

  if (!connectionUrl || connectionUrl.includes("dev.db") || connectionUrl.includes("localhost")) {
    console.error("\n❌ Error: Please provide your Railway PostgreSQL connection URL.");
    console.error("Example:");
    console.error('  $env:SOURCE_DATABASE_URL="postgresql://postgres:PASSWORD@HOST:PORT/railway"');
    console.error("  npx tsx scripts/backup-railway-db.ts\n");
    process.exit(1);
  }

  // Ensure SSL parameter is present for Railway TCP proxy
  if (connectionUrl.includes("railway") || connectionUrl.includes("rlwy.net")) {
    if (!connectionUrl.includes("sslmode")) {
      connectionUrl += (connectionUrl.includes("?") ? "&" : "?") + "sslmode=no-verify";
    }
  }

  console.log("🔌 Connecting to source database...");
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: connectionUrl,
      },
    },
  });

  try {
    console.log("📦 Fetching all data tables...");

    const [
      adminUsers,
      users,
      userPreferences,
      jobs,
      savedJobs,
      ignoredJobs,
      notifications,
      interactions,
      adminLogs,
    ] = await Promise.all([
      prisma.adminUser.findMany(),
      prisma.user.findMany(),
      prisma.userPreference.findMany(),
      prisma.job.findMany(),
      prisma.savedJob.findMany(),
      prisma.ignoredJob.findMany(),
      prisma.notification.findMany(),
      prisma.userJobInteraction.findMany(),
      prisma.adminLog.findMany(),
    ]);

    const backupData = {
      timestamp: new Date().toISOString(),
      counts: {
        adminUsers: adminUsers.length,
        users: users.length,
        userPreferences: userPreferences.length,
        jobs: jobs.length,
        savedJobs: savedJobs.length,
        ignoredJobs: ignoredJobs.length,
        notifications: notifications.length,
        interactions: interactions.length,
        adminLogs: adminLogs.length,
      },
      data: {
        adminUsers,
        users,
        userPreferences,
        jobs,
        savedJobs,
        ignoredJobs,
        notifications,
        interactions,
        adminLogs,
      },
    };

    const backupsDir = path.join(process.cwd(), "backups");
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }

    const filename = `railway_backup_${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    const filePath = path.join(backupsDir, filename);

    fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2), "utf-8");

    console.log("\n==========================================");
    console.log("✅ BACKUP COMPLETED SUCCESSFULLY!");
    console.log("==========================================");
    console.log(`📁 File saved to: ${filePath}`);
    console.log("\n📊 Export Summary:");
    console.log(`  • Registered Telegram Users : ${users.length}`);
    console.log(`  • User Preferences          : ${userPreferences.length}`);
    console.log(`  • Jobs                      : ${jobs.length}`);
    console.log(`  • Saved Jobs                : ${savedJobs.length}`);
    console.log(`  • Notifications Sent/Pending: ${notifications.length}`);
    console.log(`  • User Interactions         : ${interactions.length}`);
    console.log(`  • Admin Users               : ${adminUsers.length}`);
    console.log(`  • Admin Logs                : ${adminLogs.length}`);
    console.log("==========================================\n");
  } catch (error) {
    console.error("\n❌ Failed to backup database:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
