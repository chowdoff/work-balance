import { prisma } from "@/lib/prisma";
import { getCurrentUser, getUserRole } from "@/lib/auth-utils";
import { getDepartmentTree } from "@/lib/department-tree";
import { redirect } from "next/navigation";
import { OrganizationClient } from "./client";
import { LeaveType } from "@prisma/client";

export default async function OrganizationPage() {
  const currentUser = await getCurrentUser();
  const role = await getUserRole(currentUser.id);
  if (role !== "admin") redirect("/dashboard");

  const tree = await getDepartmentTree();

  const users = await prisma.user.findMany({
    include: {
      department: { select: { name: true } },
    },
    orderBy: { name: "asc" },
  });

  const currentWorkYear = await prisma.workYear.findFirst({
    where: { isCurrent: true },
  });

  let annualLeaveMap: Record<string, number> = {};
  if (currentWorkYear) {
    const balances = await prisma.leaveBalance.findMany({
      where: { workYearId: currentWorkYear.id, type: LeaveType.ANNUAL },
    });
    for (const b of balances) {
      annualLeaveMap[b.userId] = Number(b.total);
    }
  }

  return (
    <OrganizationClient
      tree={tree}
      users={JSON.parse(JSON.stringify(users))}
      annualLeaveMap={annualLeaveMap}
    />
  );
}
