import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  console.log("🌱 Seeding Signal Job database...");

  // Seed default admin account
  const defaultPassword = process.env.ADMIN_PASSWORD || "admin_dev_password_123";
  const hashedPassword = await bcrypt.hash(defaultPassword, 10);

  const admin = await db.adminUser.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      email: "admin@signaljob.et",
      passwordHash: hashedPassword,
      role: "SUPERADMIN",
    },
  });

  console.log(`✅ Seeded Admin account: ${admin.username} (Email: ${admin.email})`);

  // Seed sample Telegram User
  const sampleUser = await db.user.upsert({
    where: { telegramId: "123456789" },
    update: {},
    create: {
      telegramId: "123456789",
      telegramUsername: "ethio_jobseeker",
      firstName: "Abebe",
      lastName: "Bikila",
      preference: {
        create: {
          categories: JSON.stringify(["technology", "finance_accounting"]),
          professions: JSON.stringify(["Software Developer", "Accountant"]),
          locations: JSON.stringify(["Addis Ababa", "Remote"]),
          employmentTypes: JSON.stringify(["full_time", "internship"]),
          experienceLevels: JSON.stringify(["entry_level", "internship"]),
          keywords: JSON.stringify(["react", "python", "accounting"]),
        },
      },
    },
  });

  console.log(`✅ Seeded sample Telegram user: @${sampleUser.telegramUsername}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
