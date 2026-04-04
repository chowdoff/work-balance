import { prisma } from "@/lib/prisma";
import { getCurrentUser, getUserRole, getManagedDepartmentIds } from "@/lib/auth-utils";
import { getAccessibleDepartmentTree } from "@/lib/department-tree";
import { OvertimeClient } from "./client";

export default async function OvertimePage({
  searchParams,
}: {
  searchParams: Promise<{ departmentId?: string; workYearId?: string }>;
}) {
  const user = await getCurrentUser();
  const role = await getUserRole(user.id);

  const params = await searchParams;
  const workYears = await prisma.workYear.findMany({ orderBy: { startDate: "desc" } });
  const currentWorkYear = workYears.find((w) => w.isCurrent);
  const selectedWorkYearId = params.workYearId || currentWorkYear?.id;

  if (!selectedWorkYearId) {
    return <div className="text-center py-12 text-muted-foreground">暂未设置工作年度</div>;
  }

  // Department tree for filter (permission-filtered)
  const tree = role !== "employee" ? await getAccessibleDepartmentTree(user.id, role) : [];

  // Build user filter based on role and department selection
  let accessibleDeptIds: string[] | "all" = "all";
  if (role === "manager") {
    accessibleDeptIds = await getManagedDepartmentIds(user.id);
  }

  let userFilter: { id?: string; departmentId?: string | { in: string[] } } = {};
  if (role === "employee") {
    userFilter = { id: user.id };
  } else if (params.departmentId) {
    if (accessibleDeptIds !== "all" && !accessibleDeptIds.includes(params.departmentId)) {
      userFilter = { id: "none" }; // No results for unauthorized department
    } else {
      userFilter = { departmentId: params.departmentId };
    }
  } else if (accessibleDeptIds !== "all") {
    userFilter = { departmentId: { in: accessibleDeptIds } };
  }

  // Get user IDs matching filter
  const filteredUsers = await prisma.user.findMany({
    where: userFilter,
    select: { id: true },
  });
  const filteredUserIds = filteredUsers.map((u) => u.id);

  const records = await prisma.overtimeRecord.findMany({
    where: {
      workYearId: selectedWorkYearId,
      userId: { in: filteredUserIds },
    },
    include: {
      user: {
        select: { name: true, department: { select: { name: true } } },
      },
    },
    orderBy: { date: "desc" },
  });

  // Manageable users for the create dialog
  let manageableUsers: { id: string; name: string }[] = [];
  if (role !== "employee") {
    manageableUsers = await prisma.user.findMany({
      where: filteredUserIds.length > 0 ? { id: { in: filteredUserIds } } : userFilter,
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  }

  return (
    <OvertimeClient
      records={JSON.parse(JSON.stringify(records))}
      role={role}
      selectedWorkYearId={selectedWorkYearId}
      manageableUsers={manageableUsers}
      tree={tree}
      workYears={workYears.map((w) => ({
        id: w.id,
        name: w.name,
        isCurrent: w.isCurrent,
        startDate: w.startDate.toISOString().slice(0, 10),
        endDate: w.endDate.toISOString().slice(0, 10),
      }))}
      selectedDepartmentId={params.departmentId ?? ""}
    />
  );
}
