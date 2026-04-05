import { getCurrentUser, getUserRole, getManagedDepartmentIds } from "@/lib/auth-utils";
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

  // Compute countdown on server to avoid hydration mismatch
  const today = new Date();
  const wyStartDate = currentWorkYear.startDate;
  const wyEndDate = currentWorkYear.endDate;
  const totalDays = Math.ceil((wyEndDate.getTime() - wyStartDate.getTime()) / (1000 * 60 * 60 * 24));
  const remainingDays = Math.max(0, Math.ceil((wyEndDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));

  const personalData = {
    compensatoryRemaining: Number(compensatory?.remaining ?? 0),
    compensatoryTotal: Number(compensatory?.total ?? 0),
    compensatoryUsed: Number(compensatory?.used ?? 0),
    annualRemaining: Number(annual?.remaining ?? 0),
    annualTotal: Number(annual?.total ?? 0),
    annualUsed: Number(annual?.used ?? 0),
    overtimeTotal: Number(overtimeAgg._sum.days ?? 0),
    workYearName: currentWorkYear.name,
    totalDays,
    remainingDays,
    recentActivity,
  };

  // --- Department section data ---

  const tree = role !== "employee" ? await getAccessibleDepartmentTree(user.id, role) : [];
  const selectedDepartmentId = params.departmentId ?? "";

  // Determine which department to show
  let showDepartmentSection = false;
  let targetDepartmentIds: string[] = [];

  if (role === "employee") {
    // Employee sees their own department — fetch departmentId from DB
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { departmentId: true },
    });
    if (dbUser?.departmentId) {
      showDepartmentSection = true;
      targetDepartmentIds = [dbUser.departmentId];
    }
  } else if (role === "manager") {
    showDepartmentSection = true;
    const managedIds = await getManagedDepartmentIds(user.id);
    if (selectedDepartmentId && managedIds.includes(selectedDepartmentId)) {
      targetDepartmentIds = [selectedDepartmentId];
    } else {
      targetDepartmentIds = managedIds;
    }
  } else {
    // admin
    showDepartmentSection = true;
    if (selectedDepartmentId) {
      targetDepartmentIds = [selectedDepartmentId];
    }
    // empty array for admin with no filter = all users
  }

  let departmentData = null;

  if (showDepartmentSection) {
    // Get department member IDs
    const memberWhere = targetDepartmentIds.length > 0
      ? { departmentId: { in: targetDepartmentIds } }
      : {};
    const members = await prisma.user.findMany({
      where: memberWhere,
      select: { id: true, name: true },
    });
    const memberIds = members.map((m) => m.id);

    // Department stat cards: this month's overtime and leave
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const [monthlyOvertimeAgg, monthlyLeaveAgg] = await Promise.all([
      prisma.overtimeRecord.aggregate({
        where: {
          userId: { in: memberIds },
          workYearId: currentWorkYear.id,
          date: { gte: monthStart, lte: monthEnd },
        },
        _sum: { days: true },
      }),
      prisma.leaveRecord.aggregate({
        where: {
          userId: { in: memberIds },
          workYearId: currentWorkYear.id,
          date: { gte: monthStart, lte: monthEnd },
        },
        _sum: { days: true },
      }),
    ]);

    // Average compensatory remaining
    const compBalances = await prisma.leaveBalance.findMany({
      where: {
        userId: { in: memberIds },
        workYearId: currentWorkYear.id,
        type: LeaveType.COMPENSATORY,
      },
      select: { remaining: true },
    });
    const avgCompRemaining = compBalances.length > 0
      ? compBalances.reduce((sum, b) => sum + Number(b.remaining), 0) / compBalances.length
      : 0;

    // Monthly trend: aggregate overtime and leave by month across the work year
    const [overtimeRecords, leaveRecords] = await Promise.all([
      prisma.overtimeRecord.findMany({
        where: { userId: { in: memberIds }, workYearId: currentWorkYear.id },
        select: { date: true, days: true },
      }),
      prisma.leaveRecord.findMany({
        where: { userId: { in: memberIds }, workYearId: currentWorkYear.id },
        select: { date: true, days: true },
      }),
    ]);

    // Build all months from work year start to end
    const wyStart = currentWorkYear.startDate;
    const wyEnd = currentWorkYear.endDate;
    const months: { key: string; label: string }[] = [];
    const cursor = new Date(wyStart.getFullYear(), wyStart.getMonth(), 1);
    const endMonth = new Date(wyEnd.getFullYear(), wyEnd.getMonth(), 1);
    while (cursor <= endMonth) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
      const label = `${cursor.getMonth() + 1}月`;
      months.push({ key, label });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    const overtimeByMonth = new Map<string, number>();
    const leaveByMonth = new Map<string, number>();
    for (const r of overtimeRecords) {
      const key = `${r.date.getFullYear()}-${String(r.date.getMonth() + 1).padStart(2, "0")}`;
      overtimeByMonth.set(key, (overtimeByMonth.get(key) ?? 0) + Number(r.days));
    }
    for (const r of leaveRecords) {
      const key = `${r.date.getFullYear()}-${String(r.date.getMonth() + 1).padStart(2, "0")}`;
      leaveByMonth.set(key, (leaveByMonth.get(key) ?? 0) + Number(r.days));
    }

    const monthlyTrend = months.map((m) => ({
      month: m.label,
      overtimeDays: overtimeByMonth.get(m.key) ?? 0,
      leaveDays: leaveByMonth.get(m.key) ?? 0,
    }));

    // Balance ranking: per member, compensatory + annual remaining
    const allBalances = await prisma.leaveBalance.findMany({
      where: {
        userId: { in: memberIds },
        workYearId: currentWorkYear.id,
      },
      select: { userId: true, type: true, remaining: true },
    });

    const balanceMap = new Map<string, { compensatory: number; annual: number }>();
    for (const b of allBalances) {
      const entry = balanceMap.get(b.userId) ?? { compensatory: 0, annual: 0 };
      if (b.type === LeaveType.COMPENSATORY) {
        entry.compensatory = Number(b.remaining);
      } else {
        entry.annual = Number(b.remaining);
      }
      balanceMap.set(b.userId, entry);
    }

    const memberNameMap = new Map(members.map((m) => [m.id, m.name]));
    const balanceRanking = Array.from(balanceMap.entries())
      .map(([userId, bal]) => ({
        name: memberNameMap.get(userId) ?? "-",
        compensatory: bal.compensatory,
        annual: bal.annual,
      }))
      .sort((a, b) => b.compensatory - a.compensatory);

    departmentData = {
      memberCount: members.length,
      monthlyOvertimeDays: Number(monthlyOvertimeAgg._sum.days ?? 0),
      monthlyLeaveDays: Number(monthlyLeaveAgg._sum.days ?? 0),
      avgCompensatoryRemaining: Math.round(avgCompRemaining * 10) / 10,
      monthlyTrend,
      balanceRanking,
    };
  }

  return (
    <DashboardClient
      role={role}
      personalData={personalData}
      departmentData={departmentData}
      tree={tree}
      selectedDepartmentId={selectedDepartmentId}
      showDepartmentSection={showDepartmentSection}
    />
  );
}
