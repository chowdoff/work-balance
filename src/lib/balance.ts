import { prisma } from "@/lib/prisma";
import { LeaveType, Prisma } from "@prisma/client";

export async function recalculateCompensatoryBalance(
  userId: string,
  workYearId: string
) {
  const overtimeAgg = await prisma.overtimeRecord.aggregate({
    where: { userId, workYearId },
    _sum: { days: true },
  });

  const leaveAgg = await prisma.leaveRecord.aggregate({
    where: { userId, workYearId, type: LeaveType.COMPENSATORY },
    _sum: { days: true },
  });

  const total = overtimeAgg._sum.days ?? new Prisma.Decimal(0);
  const used = leaveAgg._sum.days ?? new Prisma.Decimal(0);
  const remaining = total.sub(used);

  await prisma.leaveBalance.upsert({
    where: {
      userId_workYearId_type: { userId, workYearId, type: LeaveType.COMPENSATORY },
    },
    update: { total, used, remaining },
    create: {
      userId,
      workYearId,
      type: LeaveType.COMPENSATORY,
      total,
      used,
      remaining,
    },
  });
}

export async function recalculateAnnualBalance(
  userId: string,
  workYearId: string
) {
  const existing = await prisma.leaveBalance.findUnique({
    where: {
      userId_workYearId_type: { userId, workYearId, type: LeaveType.ANNUAL },
    },
  });

  const total = existing?.total ?? new Prisma.Decimal(0);

  const leaveAgg = await prisma.leaveRecord.aggregate({
    where: { userId, workYearId, type: LeaveType.ANNUAL },
    _sum: { days: true },
  });

  const used = leaveAgg._sum.days ?? new Prisma.Decimal(0);
  const remaining = total.sub(used);

  await prisma.leaveBalance.upsert({
    where: {
      userId_workYearId_type: { userId, workYearId, type: LeaveType.ANNUAL },
    },
    update: { used, remaining },
    create: {
      userId,
      workYearId,
      type: LeaveType.ANNUAL,
      total,
      used,
      remaining,
    },
  });
}

export async function setAnnualLeaveTotal(
  userId: string,
  workYearId: string,
  totalDays: number
) {
  const total = new Prisma.Decimal(totalDays);

  const existing = await prisma.leaveBalance.findUnique({
    where: {
      userId_workYearId_type: { userId, workYearId, type: LeaveType.ANNUAL },
    },
  });

  const used = existing?.used ?? new Prisma.Decimal(0);
  const remaining = total.sub(used);

  await prisma.leaveBalance.upsert({
    where: {
      userId_workYearId_type: { userId, workYearId, type: LeaveType.ANNUAL },
    },
    update: { total, remaining },
    create: {
      userId,
      workYearId,
      type: LeaveType.ANNUAL,
      total,
      used,
      remaining,
    },
  });
}
