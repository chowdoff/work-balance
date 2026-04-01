import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { LeaveType } from "@prisma/client";

export default async function DashboardPage() {
  const user = await getCurrentUser();

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

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">
        {currentWorkYear.name}
      </h1>
      <div className="grid gap-4 sm:grid-cols-2 max-w-2xl">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              调休余额
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {compensatory?.remaining?.toString() ?? "0"} 天
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              总计 {compensatory?.total?.toString() ?? "0"} 天 / 已用{" "}
              {compensatory?.used?.toString() ?? "0"} 天
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
            <div className="text-3xl font-bold">
              {annual?.remaining?.toString() ?? "0"} 天
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              总计 {annual?.total?.toString() ?? "0"} 天 / 已用{" "}
              {annual?.used?.toString() ?? "0"} 天
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
