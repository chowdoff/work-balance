# Dashboard Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the dashboard from two balance cards into a full information center with personal stats, recent activity, department overview, and charts.

**Architecture:** Server component (`page.tsx`) queries all data and passes it to a client component (`client.tsx`) that renders charts and handles department filter interaction. The page uses URL searchParams for department filtering, matching the pattern used by overtime/leave/statistics pages.

**Tech Stack:** Next.js 16 App Router, Prisma 7, recharts (new dependency), Tailwind CSS 4, existing shadcn components.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/app/(main)/dashboard/page.tsx` | Modify | Server component: query personal data, department data, prepare chart data, pass props to client |
| `src/app/(main)/dashboard/client.tsx` | Create | Client component: render charts (recharts LineChart, BarChart), department filter, all UI sections |
| `package.json` | Modify | Add recharts dependency |

---

### Task 1: Install recharts

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install recharts**

Run:
```bash
npm install recharts
```

- [ ] **Step 2: Verify installation**

Run:
```bash
node -e "require('recharts'); console.log('recharts OK')"
```

Expected: `recharts OK`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add recharts dependency for dashboard charts"
```

---

### Task 2: Rewrite page.tsx — personal data queries

Replace the current `page.tsx` with the full server component. This task builds the personal section data (balances, overtime total, work year countdown, recent activity). Department data is added in Task 3.

**Files:**
- Modify: `src/app/(main)/dashboard/page.tsx`

- [ ] **Step 1: Write the new page.tsx with personal data queries**

Replace the entire contents of `src/app/(main)/dashboard/page.tsx` with:

```tsx
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
```

- [ ] **Step 2: Create a minimal client.tsx stub so the page compiles**

Create `src/app/(main)/dashboard/client.tsx` with a minimal stub that renders the personal section:

```tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import type { DepartmentNode } from "@/lib/department-tree";
import type { UserRole } from "@/lib/auth-utils";

type ActivityItem = {
  id: string;
  date: string;
  days: number;
  type: "OVERTIME" | "COMPENSATORY" | "ANNUAL";
  remark: string | null;
};

type PersonalData = {
  compensatoryRemaining: number;
  compensatoryTotal: number;
  compensatoryUsed: number;
  annualRemaining: number;
  annualTotal: number;
  annualUsed: number;
  overtimeTotal: number;
  workYearName: string;
  workYearStart: string;
  workYearEnd: string;
  recentActivity: ActivityItem[];
};

export type DepartmentData = {
  memberCount: number;
  monthlyOvertimeDays: number;
  monthlyLeaveDays: number;
  avgCompensatoryRemaining: number;
  monthlyTrend: { month: string; overtimeDays: number; leaveDays: number }[];
  balanceRanking: { name: string; compensatory: number; annual: number }[];
};

export function DashboardClient({
  role,
  personalData,
  departmentData,
  tree,
  selectedDepartmentId,
  showDepartmentSection,
}: {
  role: UserRole;
  personalData: PersonalData;
  departmentData: DepartmentData | null;
  tree: DepartmentNode[];
  selectedDepartmentId: string;
  showDepartmentSection: boolean;
}) {
  const today = new Date();
  const endDate = new Date(personalData.workYearEnd);
  const startDate = new Date(personalData.workYearStart);
  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const remainingDays = Math.max(0, Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
  const progress = totalDays > 0 ? Math.min(100, Math.max(0, ((totalDays - remainingDays) / totalDays) * 100)) : 0;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{personalData.workYearName}</h1>

      {/* Personal balance cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              调休余额
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{personalData.compensatoryRemaining} 天</div>
            <p className="text-sm text-muted-foreground mt-1">
              总计 {personalData.compensatoryTotal} 天 / 已用 {personalData.compensatoryUsed} 天
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              年假余额
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{personalData.annualRemaining} 天</div>
            <p className="text-sm text-muted-foreground mt-1">
              总计 {personalData.annualTotal} 天 / 已用 {personalData.annualUsed} 天
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              累计加班
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{personalData.overtimeTotal} 天</div>
            <p className="text-sm text-muted-foreground mt-1">
              本年度加班总天数
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              年度倒计时
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{remainingDays} 天</div>
            <div className="mt-2">
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                共 {totalDays} 天 / 已过 {totalDays - remainingDays} 天
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent activity */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-base">近期动态</CardTitle>
        </CardHeader>
        <CardContent>
          {personalData.recentActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无记录</p>
          ) : (
            <div className="space-y-3">
              {personalData.recentActivity.map((item) => (
                <div key={item.id} className="flex items-center gap-3 text-sm">
                  <span className="text-muted-foreground w-24 shrink-0">{item.date}</span>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      item.type === "OVERTIME"
                        ? "bg-orange-100 text-orange-700"
                        : item.type === "COMPENSATORY"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-green-100 text-green-700"
                    }`}
                  >
                    {item.type === "OVERTIME" ? "加班" : item.type === "COMPENSATORY" ? "调休" : "年假"}
                  </span>
                  <span className="font-medium">{item.days} 天</span>
                  {item.remark && (
                    <span className="text-muted-foreground truncate">{item.remark}</span>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-4 mt-4 pt-3 border-t">
            <Link href="/overtime" className="text-sm text-primary hover:underline">
              查看加班记录
            </Link>
            <Link href="/leave" className="text-sm text-primary hover:underline">
              查看请假记录
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Department section placeholder - Task 4 fills this in */}
    </div>
  );
}
```

- [ ] **Step 3: Verify the build compiles**

Run:
```bash
npx next build 2>&1 | tail -5
```

Expected: Build succeeds (exit code 0).

- [ ] **Step 4: Commit**

```bash
git add src/app/\(main\)/dashboard/page.tsx src/app/\(main\)/dashboard/client.tsx
git commit -m "feat(dashboard): add personal section with balance cards, overtime total, countdown, and recent activity"
```

---

### Task 3: Add department data queries to page.tsx

Add the department section data queries to `page.tsx`. This includes department member filtering, monthly stats, trend data, and balance ranking.

**Files:**
- Modify: `src/app/(main)/dashboard/page.tsx`

- [ ] **Step 1: Replace the department data placeholder in page.tsx**

In `src/app/(main)/dashboard/page.tsx`, replace the block:

```tsx
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
```

with:

```tsx
  // --- Department section data ---

  const tree = role !== "employee" ? await getAccessibleDepartmentTree(user.id, role) : [];
  const selectedDepartmentId = params.departmentId ?? "";

  // Determine which department to show
  let showDepartmentSection = false;
  let targetDepartmentIds: string[] = [];

  if (role === "employee") {
    // Employee sees their own department
    if (user.departmentId) {
      showDepartmentSection = true;
      targetDepartmentIds = [user.departmentId];
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
```

- [ ] **Step 2: Verify the build compiles**

Run:
```bash
npx next build 2>&1 | tail -5
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(main\)/dashboard/page.tsx
git commit -m "feat(dashboard): add department data queries with role-based filtering"
```

---

### Task 4: Add department section UI to client.tsx

Add the department section to `client.tsx`: department filter, stat cards, trend line chart, and balance ranking bar chart.

**Files:**
- Modify: `src/app/(main)/dashboard/client.tsx`

- [ ] **Step 1: Add recharts imports and department section to client.tsx**

In `src/app/(main)/dashboard/client.tsx`, add the recharts import at the top alongside existing imports:

```tsx
import { useRouter } from "next/navigation";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
```

Also add the `DepartmentTreeSelect` import:

```tsx
import { DepartmentTreeSelect } from "@/components/department-tree-select";
```

- [ ] **Step 2: Add department section rendering after the recent activity card**

In `client.tsx`, replace the comment `{/* Department section placeholder - Task 4 fills this in */}` with:

```tsx
      {/* Department section */}
      {showDepartmentSection && departmentData && (
        <div>
          <div className="flex items-center gap-4 mb-6">
            <h2 className="text-lg font-semibold">部门概览</h2>
            {role !== "employee" && (
              <div className="w-48">
                <DepartmentTreeSelect
                  tree={tree}
                  value={selectedDepartmentId}
                  onChange={(v) => {
                    const params = new URLSearchParams();
                    if (v) params.set("departmentId", v);
                    router.push(`/dashboard${params.toString() ? `?${params.toString()}` : ""}`);
                  }}
                  allowEmpty
                />
              </div>
            )}
          </div>

          {/* Department stat cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  部门人数
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{departmentData.memberCount} 人</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  本月加班
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{departmentData.monthlyOvertimeDays} 天</div>
                <p className="text-sm text-muted-foreground mt-1">部门本月加班总天数</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  本月请假
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{departmentData.monthlyLeaveDays} 天</div>
                <p className="text-sm text-muted-foreground mt-1">部门本月请假总天数</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  人均调休余额
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{departmentData.avgCompensatoryRemaining} 天</div>
              </CardContent>
            </Card>
          </div>

          {/* Monthly trend line chart */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-base">月度加班/请假趋势</CardTitle>
            </CardHeader>
            <CardContent>
              {departmentData.monthlyTrend.every((m) => m.overtimeDays === 0 && m.leaveDays === 0) ? (
                <p className="text-sm text-muted-foreground text-center py-8">暂无数据</p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={departmentData.monthlyTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="overtimeDays"
                      name="加班(天)"
                      stroke="#f97316"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="leaveDays"
                      name="请假(天)"
                      stroke="#3b82f6"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Balance ranking bar chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">团队余额排行</CardTitle>
            </CardHeader>
            <CardContent>
              {departmentData.balanceRanking.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">暂无数据</p>
              ) : (
                <div className={departmentData.balanceRanking.length > 15 ? "overflow-x-auto" : ""}>
                  <div style={{ minWidth: departmentData.balanceRanking.length > 15 ? departmentData.balanceRanking.length * 60 : undefined }}>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={departmentData.balanceRanking}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="compensatory" name="调休余额" fill="#3b82f6" />
                        <Bar dataKey="annual" name="年假余额" fill="#10b981" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
```

Also add `const router = useRouter();` at the top of the `DashboardClient` function body (before the `today` line).

- [ ] **Step 3: Verify the build compiles**

Run:
```bash
npx next build 2>&1 | tail -5
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(main\)/dashboard/client.tsx
git commit -m "feat(dashboard): add department section with filter, stat cards, trend chart, and ranking chart"
```

---

### Task 5: Lint check and final verification

**Files:**
- All dashboard files

- [ ] **Step 1: Run lint**

Run:
```bash
npm run lint
```

Expected: No errors.

- [ ] **Step 2: Run production build**

Run:
```bash
npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 3: Fix any lint or build errors**

If any errors are found, fix them and re-run.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix(dashboard): resolve lint and build issues"
```

Only run this step if there were fixes needed.
