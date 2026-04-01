"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser, getUserRole } from "@/lib/auth-utils";
import { revalidatePath } from "next/cache";

export async function createWorkYear(formData: FormData) {
  const user = await getCurrentUser();
  const role = await getUserRole(user.id);
  if (role !== "admin") throw new Error("无权限");

  const name = formData.get("name") as string;
  const startDate = formData.get("startDate") as string;
  const endDate = formData.get("endDate") as string;

  await prisma.workYear.create({
    data: {
      name,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    },
  });

  revalidatePath("/work-year");
}

export async function updateWorkYear(id: string, formData: FormData) {
  const user = await getCurrentUser();
  const role = await getUserRole(user.id);
  if (role !== "admin") throw new Error("无权限");

  const name = formData.get("name") as string;
  const startDate = formData.get("startDate") as string;
  const endDate = formData.get("endDate") as string;

  await prisma.workYear.update({
    where: { id },
    data: {
      name,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    },
  });

  revalidatePath("/work-year");
}

export async function setCurrentWorkYear(id: string) {
  const user = await getCurrentUser();
  const role = await getUserRole(user.id);
  if (role !== "admin") throw new Error("无权限");

  await prisma.$transaction([
    prisma.workYear.updateMany({
      where: { isCurrent: true },
      data: { isCurrent: false },
    }),
    prisma.workYear.update({
      where: { id },
      data: { isCurrent: true },
    }),
  ]);

  revalidatePath("/work-year");
  revalidatePath("/dashboard");
}

export async function deleteWorkYear(id: string) {
  const user = await getCurrentUser();
  const role = await getUserRole(user.id);
  if (role !== "admin") throw new Error("无权限");

  const workYear = await prisma.workYear.findUnique({ where: { id } });
  if (workYear?.isCurrent) throw new Error("不能删除当前工作年度");

  const hasOvertimeRecords = await prisma.overtimeRecord.findFirst({
    where: { workYearId: id },
  });
  if (hasOvertimeRecords) throw new Error("该年度下存在记录，无法删除");

  const hasLeaveRecords = await prisma.leaveRecord.findFirst({
    where: { workYearId: id },
  });
  if (hasLeaveRecords) throw new Error("该年度下存在记录，无法删除");

  await prisma.workYear.delete({ where: { id } });
  revalidatePath("/work-year");
}
