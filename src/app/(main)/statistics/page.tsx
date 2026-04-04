import { prisma } from "@/lib/prisma";
import { getCurrentUser, getUserRole, getManagedDepartmentIds } from "@/lib/auth-utils";
import { getAccessibleDepartmentTree } from "@/lib/department-tree";
import { redirect } from "next/navigation";
import { StatisticsClient } from "./client";
import { LeaveType } from "@prisma/client";

export default async function StatisticsPage({
  searchParams,
}: {
  searchParams: Promise<{ departmentId?: string; workYearId?: string }>;
}) {
  const user = await getCurrentUser();
  const role = await getUserRole(user.id);
  if (role === "employee") redirect("/dashboard");

  const params = await searchParams;
  const tree = await getAccessibleDepartmentTree(user.id, role);
  const workYears = await prisma.workYear.findMany({ orderBy: { startDate: "desc" } });
  const currentWorkYear = workYears.find((w) => w.isCurrent);
  const selectedWorkYearId = params.workYearId || currentWorkYear?.id;

  if (!selectedWorkYearId) {
    return <div className="text-center py-12 text-muted-foreground">暂未设置工作年度</div>;
  }

  let accessibleDeptIds: string[] | "all" = "all";
  if (role === "manager") {
    accessibleDeptIds = await getManagedDepartmentIds(user.id);
  }

  let userWhere: { departmentId?: string | { in: string[] } } = {};
  if (params.departmentId) {
    if (accessibleDeptIds !== "all" && !accessibleDeptIds.includes(params.departmentId)) {
      redirect("/dashboard");
    }
    userWhere = { departmentId: params.departmentId };
  } else if (accessibleDeptIds !== "all") {
    userWhere = { departmentId: { in: accessibleDeptIds } };
  }

  const users = await prisma.user.findMany({
    where: userWhere,
    include: {
      department: { select: { name: true } },
      overtimeRecords: {
        where: { workYearId: selectedWorkYearId },
        select: { days: true },
      },
      leaveRecords: {
        where: { workYearId: selectedWorkYearId },
        select: { days: true, type: true },
      },
      leaveBalances: {
        where: { workYearId: selectedWorkYearId },
      },
    },
    orderBy: { name: "asc" },
  });

  const stats = users.map((u) => {
    const overtimeDays = u.overtimeRecords.reduce(
      (sum, r) => sum + Number(r.days),
      0
    );
    const compLeaveDays = u.leaveRecords
      .filter((r) => r.type === LeaveType.COMPENSATORY)
      .reduce((sum, r) => sum + Number(r.days), 0);
    const annualLeaveDays = u.leaveRecords
      .filter((r) => r.type === LeaveType.ANNUAL)
      .reduce((sum, r) => sum + Number(r.days), 0);

    const compBalance = u.leaveBalances.find(
      (b) => b.type === LeaveType.COMPENSATORY
    );
    const annualBalance = u.leaveBalances.find(
      (b) => b.type === LeaveType.ANNUAL
    );

    return {
      id: u.id,
      name: u.name,
      department: u.department?.name ?? "-",
      overtimeDays,
      compLeaveDays,
      compRemaining: Number(compBalance?.remaining ?? 0),
      annualLeaveDays,
      annualTotal: Number(annualBalance?.total ?? 0),
      annualRemaining: Number(annualBalance?.remaining ?? 0),
    };
  });

  return (
    <StatisticsClient
      stats={stats}
      tree={tree}
      workYears={JSON.parse(JSON.stringify(workYears))}
      selectedDepartmentId={params.departmentId ?? ""}
      selectedWorkYearId={selectedWorkYearId}
    />
  );
}
