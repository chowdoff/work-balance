"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser, getUserRole, getAccessibleUserIds } from "@/lib/auth-utils";
import { recalculateCompensatoryBalance, recalculateAnnualBalance } from "@/lib/balance";
import { LeaveType, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function createLeave(formData: FormData) {
  const currentUser = await getCurrentUser();
  const role = await getUserRole(currentUser.id);
  if (role === "employee") throw new Error("无权限");

  const userId = formData.get("userId") as string;
  const workYearId = formData.get("workYearId") as string;
  const type = formData.get("type") as LeaveType;
  const date = formData.get("date") as string;
  const days = parseFloat(formData.get("days") as string);
  const remark = (formData.get("remark") as string) || null;

  const accessible = await getAccessibleUserIds(currentUser.id, role);
  if (accessible !== "all" && !accessible.includes(userId)) {
    throw new Error("无权操作此员工");
  }

  const workYear = await prisma.workYear.findUnique({ where: { id: workYearId } });
  if (!workYear) throw new Error("工作年度不存在");

  const dateObj = new Date(date);
  if (dateObj < workYear.startDate || dateObj > workYear.endDate) {
    const start = workYear.startDate.toISOString().slice(0, 10);
    const end = workYear.endDate.toISOString().slice(0, 10);
    throw new Error(`日期必须在工作年度范围内（${start} ~ ${end}）`);
  }

  const balance = await prisma.leaveBalance.findUnique({
    where: { userId_workYearId_type: { userId, workYearId, type } },
  });

  const remaining = balance?.remaining ?? new Prisma.Decimal(0);
  if (remaining.lt(new Prisma.Decimal(days))) {
    throw new Error(`额度不足，剩余 ${remaining} 天`);
  }

  await prisma.leaveRecord.create({
    data: { userId, workYearId, type, date: new Date(date), days, remark },
  });

  if (type === LeaveType.COMPENSATORY) {
    await recalculateCompensatoryBalance(userId, workYearId);
  } else {
    await recalculateAnnualBalance(userId, workYearId);
  }

  revalidatePath("/leave");
  revalidatePath("/dashboard");
}

export async function updateLeave(id: string, formData: FormData) {
  const currentUser = await getCurrentUser();
  const role = await getUserRole(currentUser.id);
  if (role === "employee") throw new Error("无权限");

  const record = await prisma.leaveRecord.findUnique({ where: { id } });
  if (!record) throw new Error("记录不存在");

  const accessible = await getAccessibleUserIds(currentUser.id, role);
  if (accessible !== "all" && !accessible.includes(record.userId)) {
    throw new Error("无权操作");
  }

  const date = formData.get("date") as string;
  const days = parseFloat(formData.get("days") as string);
  const remark = (formData.get("remark") as string) || null;

  const workYear = await prisma.workYear.findUnique({ where: { id: record.workYearId } });
  if (!workYear) throw new Error("工作年度不存在");

  const dateObj = new Date(date);
  if (dateObj < workYear.startDate || dateObj > workYear.endDate) {
    const start = workYear.startDate.toISOString().slice(0, 10);
    const end = workYear.endDate.toISOString().slice(0, 10);
    throw new Error(`日期必须在工作年度范围内（${start} ~ ${end}）`);
  }

  const balance = await prisma.leaveBalance.findUnique({
    where: {
      userId_workYearId_type: {
        userId: record.userId,
        workYearId: record.workYearId,
        type: record.type,
      },
    },
  });

  const currentRemaining = balance?.remaining ?? new Prisma.Decimal(0);
  const oldDays = record.days;
  const availableAfterRestore = currentRemaining.add(oldDays);

  if (availableAfterRestore.lt(new Prisma.Decimal(days))) {
    throw new Error(`额度不足，可用 ${availableAfterRestore} 天`);
  }

  await prisma.leaveRecord.update({
    where: { id },
    data: { date: new Date(date), days, remark },
  });

  if (record.type === LeaveType.COMPENSATORY) {
    await recalculateCompensatoryBalance(record.userId, record.workYearId);
  } else {
    await recalculateAnnualBalance(record.userId, record.workYearId);
  }

  revalidatePath("/leave");
  revalidatePath("/dashboard");
}

export async function deleteLeave(id: string) {
  const currentUser = await getCurrentUser();
  const role = await getUserRole(currentUser.id);
  if (role === "employee") throw new Error("无权限");

  const record = await prisma.leaveRecord.findUnique({ where: { id } });
  if (!record) throw new Error("记录不存在");

  const accessible = await getAccessibleUserIds(currentUser.id, role);
  if (accessible !== "all" && !accessible.includes(record.userId)) {
    throw new Error("无权操作");
  }

  await prisma.leaveRecord.delete({ where: { id } });

  if (record.type === LeaveType.COMPENSATORY) {
    await recalculateCompensatoryBalance(record.userId, record.workYearId);
  } else {
    await recalculateAnnualBalance(record.userId, record.workYearId);
  }

  revalidatePath("/leave");
  revalidatePath("/dashboard");
}
