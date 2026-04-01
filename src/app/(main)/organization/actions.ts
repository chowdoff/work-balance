"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser, getUserRole } from "@/lib/auth-utils";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";

async function requireAdmin() {
  const user = await getCurrentUser();
  const role = await getUserRole(user.id);
  if (role !== "admin") throw new Error("无权限");
}

// --- 部门管理 ---

export async function createDepartment(formData: FormData) {
  await requireAdmin();
  const name = formData.get("name") as string;
  const parentId = (formData.get("parentId") as string) || null;
  const managerId = (formData.get("managerId") as string) || null;

  await prisma.department.create({
    data: { name, parentId, managerId },
  });

  revalidatePath("/organization");
}

export async function updateDepartment(id: string, formData: FormData) {
  await requireAdmin();
  const name = formData.get("name") as string;
  const parentId = (formData.get("parentId") as string) || null;
  const managerId = (formData.get("managerId") as string) || null;

  await prisma.department.update({
    where: { id },
    data: { name, parentId, managerId },
  });

  revalidatePath("/organization");
}

export async function deleteDepartment(id: string) {
  await requireAdmin();

  const hasChildren = await prisma.department.findFirst({
    where: { parentId: id },
  });
  if (hasChildren) throw new Error("该部门下有子部门，无法删除");

  const hasMembers = await prisma.user.findFirst({
    where: { departmentId: id },
  });
  if (hasMembers) throw new Error("该部门下有员工，无法删除");

  await prisma.department.delete({ where: { id } });
  revalidatePath("/organization");
}

// --- 员工管理 ---

export async function createUser(formData: FormData) {
  await requireAdmin();
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const departmentId = (formData.get("departmentId") as string) || null;
  const annualLeave = parseFloat(formData.get("annualLeave") as string) || 0;

  const hashedPassword = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: { name, email, password: hashedPassword, departmentId },
  });

  if (annualLeave > 0) {
    const currentWorkYear = await prisma.workYear.findFirst({
      where: { isCurrent: true },
    });
    if (currentWorkYear) {
      const { setAnnualLeaveTotal } = await import("@/lib/balance");
      await setAnnualLeaveTotal(user.id, currentWorkYear.id, annualLeave);
    }
  }

  revalidatePath("/organization");
}

export async function updateUser(id: string, formData: FormData) {
  await requireAdmin();
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const departmentId = (formData.get("departmentId") as string) || null;
  const annualLeave = parseFloat(formData.get("annualLeave") as string) || 0;
  const newPassword = formData.get("newPassword") as string;

  const data: { name: string; email: string; departmentId: string | null; password?: string } = { name, email, departmentId };
  if (newPassword) {
    data.password = await bcrypt.hash(newPassword, 12);
  }

  await prisma.user.update({ where: { id }, data });

  const currentWorkYear = await prisma.workYear.findFirst({
    where: { isCurrent: true },
  });
  if (currentWorkYear && annualLeave > 0) {
    const { setAnnualLeaveTotal } = await import("@/lib/balance");
    await setAnnualLeaveTotal(id, currentWorkYear.id, annualLeave);
  }

  revalidatePath("/organization");
}

export async function deleteUser(id: string) {
  await requireAdmin();

  const user = await prisma.user.findUnique({ where: { id } });
  if (user?.isAdmin) throw new Error("不能删除管理员账号");

  await prisma.department.updateMany({
    where: { managerId: id },
    data: { managerId: null },
  });

  await prisma.$transaction([
    prisma.leaveRecord.deleteMany({ where: { userId: id } }),
    prisma.overtimeRecord.deleteMany({ where: { userId: id } }),
    prisma.leaveBalance.deleteMany({ where: { userId: id } }),
    prisma.user.delete({ where: { id } }),
  ]);

  revalidatePath("/organization");
}
