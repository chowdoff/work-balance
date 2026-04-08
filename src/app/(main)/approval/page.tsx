import { prisma } from "@/lib/prisma";
import {
  getCurrentUser,
  getUserRole,
  getManagedDepartmentIds,
} from "@/lib/auth-utils";
import { ApprovalStatus } from "@prisma/client";
import { ApprovalClient } from "./client";

export default async function ApprovalPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; status?: string }>;
}) {
  const user = await getCurrentUser();
  const role = await getUserRole(user.id);
  const params = await searchParams;

  const workYears = await prisma.workYear.findMany({
    orderBy: { startDate: "desc" },
  });
  const currentWorkYear = workYears.find((w) => w.isCurrent);

  if (!currentWorkYear) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        暂未设置当前工作年度，请联系管理员。
      </div>
    );
  }

  // Tab 1: My requests (all roles)
  const statusFilter = params.status as ApprovalStatus | undefined;
  const myRequests = await prisma.approvalRequest.findMany({
    where: {
      applicantId: user.id,
      ...(statusFilter ? { status: statusFilter } : {}),
    },
    include: {
      workYear: { select: { name: true } },
      approver: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Tab 2 & 3: Pending / processed requests for approvers
  let pendingRequests: typeof myRequests = [];
  let processedRequests: typeof myRequests = [];

  if (role !== "employee") {
    let applicantFilter: { in: string[] } | undefined;

    if (role === "manager") {
      const deptIds = await getManagedDepartmentIds(user.id);
      const subordinates = await prisma.user.findMany({
        where: { departmentId: { in: deptIds } },
        select: { id: true },
      });
      const subordinateIds = subordinates
        .map((s) => s.id)
        .filter((id) => id !== user.id);
      applicantFilter = { in: subordinateIds };
    }

    const approverWhere = applicantFilter
      ? { applicantId: applicantFilter }
      : { applicantId: { not: user.id } };

    pendingRequests = await prisma.approvalRequest.findMany({
      where: {
        ...approverWhere,
        status: ApprovalStatus.PENDING,
      },
      include: {
        applicant: {
          select: { name: true, department: { select: { name: true } } },
        },
        workYear: { select: { name: true } },
        approver: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    processedRequests = await prisma.approvalRequest.findMany({
      where: {
        approverId: user.id,
        status: { in: [ApprovalStatus.APPROVED, ApprovalStatus.REJECTED] },
      },
      include: {
        applicant: {
          select: { name: true, department: { select: { name: true } } },
        },
        workYear: { select: { name: true } },
        approver: { select: { name: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  return (
    <ApprovalClient
      role={role}
      myRequests={JSON.parse(JSON.stringify(myRequests))}
      pendingRequests={JSON.parse(JSON.stringify(pendingRequests))}
      processedRequests={JSON.parse(JSON.stringify(processedRequests))}
      workYears={workYears.map((w) => ({
        id: w.id,
        name: w.name,
        isCurrent: w.isCurrent,
        startDate: w.startDate.toISOString().slice(0, 10),
        endDate: w.endDate.toISOString().slice(0, 10),
      }))}
      currentWorkYearId={currentWorkYear.id}
      defaultTab={params.tab ?? "my"}
      defaultStatus={params.status ?? ""}
    />
  );
}
