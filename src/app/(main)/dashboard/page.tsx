import { getCurrentUser, getUserRole } from "@/lib/auth-utils";
import { getAccessibleDepartmentTree } from "@/lib/department-tree";
import { prisma } from "@/lib/prisma";
import { LeaveType } from "@prisma/client";
import { DashboardClient } from "./client";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ departmentId?: string }>;
}) {
  const user = await getCurrentUser();
  const role = await getUserRole(user.id);
  const params = await searchParams;

  const currentWorkYear = await prisma.workYear.findFirst({
    where: { isCurrent: true },
  });

  if (!currentWorkYear) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        暂未设置当前工作年度，请联系管理员。
      </div>
    );
  }

  // --- Personal section data ---

  const compensatory = await prisma.leaveBalance.findUnique({
    where: {
      userId_workYearId_type: {
        userId: user.id,
        workYearId: currentWorkYear.id,
        type: LeaveType.COMPENSATORY,
      },
    },
  });

  const annual = await prisma.leaveBalance.findUnique({
    where: {
      userId_workYearId_type: {
        userId: user.id,
        workYearId: currentWorkYear.id,
        type: LeaveType.ANNUAL,
      },
    },
  });

  const overtimeAgg = await prisma.overtimeRecord.aggregate({
    where: { userId: user.id, workYearId: currentWorkYear.id },
    _sum: { days: true },
  });

  // Recent activity: merge overtime + leave records, take latest 5
  const [recentOvertime, recentLeave] = await Promise.all([
    prisma.overtimeRecord.findMany({
      where: { userId: user.id, workYearId: currentWorkYear.id },
      orderBy: { date: "desc" },
      take: 5,
      select: { id: true, date: true, days: true, remark: true },
    }),
    prisma.leaveRecord.findMany({
      where: { userId: user.id, workYearId: currentWorkYear.id },
      orderBy: { date: "desc" },
      take: 5,
      select: { id: true, date: true, days: true, type: true, remark: true },
    }),
  ]);

  type ActivityItem = {
    id: string;
    date: string;
    days: number;
    type: "OVERTIME" | "COMPENSATORY" | "ANNUAL";
    remark: string | null;
  };

  const recentActivity: ActivityItem[] = [
    ...recentOvertime.map((r) => ({
      id: r.id,
      date: r.date.toISOString().slice(0, 10),
      days: Number(r.days),
      type: "OVERTIME" as const,
      remark: r.remark,
    })),
    ...recentLeave.map((r) => ({
      id: r.id,
      date: r.date.toISOString().slice(0, 10),
      days: Number(r.days),
      type: r.type as "COMPENSATORY" | "ANNUAL",
      remark: r.remark,
    })),
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  const personalData = {
    compensatoryRemaining: Number(compensatory?.remaining ?? 0),
    compensatoryTotal: Number(compensatory?.total ?? 0),
    compensatoryUsed: Number(compensatory?.used ?? 0),
    annualRemaining: Number(annual?.remaining ?? 0),
    annualTotal: Number(annual?.total ?? 0),
    annualUsed: Number(annual?.used ?? 0),
    overtimeTotal: Number(overtimeAgg._sum.days ?? 0),
    workYearName: currentWorkYear.name,
    workYearStart: currentWorkYear.startDate.toISOString().slice(0, 10),
    workYearEnd: currentWorkYear.endDate.toISOString().slice(0, 10),
    recentActivity,
  };

  // --- Department section data (Task 3 will fill this in) ---

  const departmentData = null;
  const tree = role !== "employee" ? await getAccessibleDepartmentTree(user.id, role) : [];
  const selectedDepartmentId = params.departmentId ?? "";

  return (
    <DashboardClient
      role={role}
      personalData={personalData}
      departmentData={departmentData}
      tree={tree}
      selectedDepartmentId={selectedDepartmentId}
      showDepartmentSection={false}
    />
  );
}
