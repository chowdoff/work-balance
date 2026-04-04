import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function main() {
  const adminEmail = requireEnv("SEED_ADMIN_EMAIL");
  const adminPassword = requireEnv("SEED_ADMIN_PASSWORD");
  const adminName = requireEnv("SEED_ADMIN_NAME");

  const hashedPassword = await bcrypt.hash(adminPassword, 12);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      name: adminName,
      email: adminEmail,
      password: hashedPassword,
      isAdmin: true,
    },
  });

  const workYearName = requireEnv("SEED_WORK_YEAR_NAME");
  const workYearStart = requireEnv("SEED_WORK_YEAR_START");
  const workYearEnd = requireEnv("SEED_WORK_YEAR_END");

  const existingWorkYear = await prisma.workYear.findFirst({
    where: { isCurrent: true },
  });

  if (!existingWorkYear) {
    await prisma.workYear.create({
      data: {
        name: workYearName,
        startDate: new Date(workYearStart),
        endDate: new Date(workYearEnd),
        isCurrent: true,
      },
    });
  }

  console.log("Seed completed: admin user + default work year created");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
