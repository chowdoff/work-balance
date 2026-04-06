"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
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
import { DepartmentTreeSelect } from "@/components/department-tree-select";
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
  totalDays: number;
  remainingDays: number;
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
  const router = useRouter();
  const { totalDays, remainingDays } = personalData;
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
                          ? "bg-green-100 text-green-700"
                          : "bg-blue-100 text-blue-700"
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
                        <Bar dataKey="compensatory" name="调休余额" fill="#10b981" />
                        <Bar dataKey="annual" name="年假余额" fill="#3b82f6" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
