import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export type UserRole = "admin" | "manager" | "employee";

export async function getCurrentUser() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session.user;
}

export async function getUserRole(userId: string): Promise<UserRole> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isAdmin: true },
  });

  if (user?.isAdmin) return "admin";

  const managedDepartment = await prisma.department.findFirst({
    where: { managerId: userId },
    select: { id: true },
  });

  if (managedDepartment) return "manager";

  return "employee";
}

export async function getManagedDepartmentIds(userId: string): Promise<string[]> {
  const departments = await prisma.department.findMany({
    where: { managerId: userId },
    select: { id: true },
  });

  if (departments.length === 0) return [];

  const { getSubDepartmentIds } = await import("@/lib/department-tree");
  const allIds: string[] = [];

  for (const dept of departments) {
    const subIds = await getSubDepartmentIds(dept.id);
    allIds.push(dept.id, ...subIds);
  }

  return [...new Set(allIds)];
}

export async function getAccessibleUserIds(userId: string, role: UserRole): Promise<string[] | "all"> {
  if (role === "admin") return "all";

  if (role === "manager") {
    const deptIds = await getManagedDepartmentIds(userId);
    const users = await prisma.user.findMany({
      where: { departmentId: { in: deptIds } },
      select: { id: true },
    });
    return users.map((u) => u.id);
  }

  return [userId];
}
