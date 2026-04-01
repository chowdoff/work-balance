import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@company.com";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "admin123";
  const adminName = process.env.SEED_ADMIN_NAME ?? "系统管理员";

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

  const currentYear = new Date().getFullYear();
  const workYearName = process.env.SEED_WORK_YEAR_NAME ?? `${currentYear}年度`;
  const workYearStart = process.env.SEED_WORK_YEAR_START ?? `${currentYear}-01-01`;
  const workYearEnd = process.env.SEED_WORK_YEAR_END ?? `${currentYear}-12-31`;

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
