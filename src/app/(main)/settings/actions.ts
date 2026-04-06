"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-utils";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";

export async function changePassword(formData: FormData) {
  const user = await getCurrentUser();

  const currentPassword = formData.get("currentPassword") as string;
  const newPassword = formData.get("newPassword") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (newPassword !== confirmPassword) {
    throw new Error("两次输入的密码不一致");
  }

  if (newPassword.length < 6) {
    throw new Error("密码长度至少6位");
  }

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser) throw new Error("用户不存在");

  const isValid = await bcrypt.compare(currentPassword, dbUser.password);
  if (!isValid) throw new Error("当前密码错误");

  const hashedPassword = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashedPassword },
  });

  revalidatePath("/settings");
  return { success: true };
}

export async function changeName(formData: FormData) {
  const user = await getCurrentUser();

  const name = (formData.get("name") as string)?.trim();

  if (!name) {
    throw new Error("姓名不能为空");
  }

  if (name.length > 50) {
    throw new Error("姓名不能超过50个字符");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { name },
  });

  revalidatePath("/settings");
  return { success: true };
}
