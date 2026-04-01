"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser, getUserRole, getAccessibleUserIds } from "@/lib/auth-utils";
import { recalculateCompensatoryBalance } from "@/lib/balance";
import { revalidatePath } from "next/cache";

export async function createOvertime(formData: FormData) {
  const currentUser = await getCurrentUser();
  const role = await getUserRole(currentUser.id);
  if (role === "employee") throw new Error("无权限");

  const userId = formData.get("userId") as string;
  const workYearId = formData.get("workYearId") as string;
  const date = formData.get("date") as string;
  const days = parseFloat(formData.get("days") as string);
  const remark = (formData.get("remark") as string) || null;

  const accessible = await getAccessibleUserIds(currentUser.id, role);
  if (accessible !== "all" && !accessible.includes(userId)) {
    throw new Error("无权操作此员工");
  }

  await prisma.overtimeRecord.create({
    data: { userId, workYearId, date: new Date(date), days, remark },
  });

  await recalculateCompensatoryBalance(userId, workYearId);
  revalidatePath("/overtime");
  revalidatePath("/dashboard");
}

export async function updateOvertime(id: string, formData: FormData) {
  const currentUser = await getCurrentUser();
  const role = await getUserRole(currentUser.id);
  if (role === "employee") throw new Error("无权限");

  const record = await prisma.overtimeRecord.findUnique({ where: { id } });
  if (!record) throw new Error("记录不存在");

  const accessible = await getAccessibleUserIds(currentUser.id, role);
  if (accessible !== "all" && !accessible.includes(record.userId)) {
    throw new Error("无权操作");
  }

  const date = formData.get("date") as string;
  const days = parseFloat(formData.get("days") as string);
  const remark = (formData.get("remark") as string) || null;

  await prisma.overtimeRecord.update({
    where: { id },
    data: { date: new Date(date), days, remark },
  });

  await recalculateCompensatoryBalance(record.userId, record.workYearId);
  revalidatePath("/overtime");
  revalidatePath("/dashboard");
}

export async function deleteOvertime(id: string) {
  const currentUser = await getCurrentUser();
  const role = await getUserRole(currentUser.id);
  if (role === "employee") throw new Error("无权限");

  const record = await prisma.overtimeRecord.findUnique({ where: { id } });
  if (!record) throw new Error("记录不存在");

  const accessible = await getAccessibleUserIds(currentUser.id, role);
  if (accessible !== "all" && !accessible.includes(record.userId)) {
    throw new Error("无权操作");
  }

  await prisma.overtimeRecord.delete({ where: { id } });
  await recalculateCompensatoryBalance(record.userId, record.workYearId);
  revalidatePath("/overtime");
  revalidatePath("/dashboard");
}
