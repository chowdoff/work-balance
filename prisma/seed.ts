import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const hashedPassword = await bcrypt.hash("admin123", 12);

  await prisma.user.upsert({
    where: { email: "admin@company.com" },
    update: {},
    create: {
      name: "系统管理员",
      email: "admin@company.com",
      password: hashedPassword,
      isAdmin: true,
    },
  });

  const currentYear = new Date().getFullYear();
  const existingWorkYear = await prisma.workYear.findFirst({
    where: { isCurrent: true },
  });

  if (!existingWorkYear) {
    await prisma.workYear.create({
      data: {
        name: `${currentYear}年度`,
        startDate: new Date(`${currentYear}-01-01`),
        endDate: new Date(`${currentYear}-12-31`),
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
