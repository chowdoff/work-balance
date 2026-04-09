import { prisma } from "@/lib/prisma";
import {
  getCurrentUser,
  getUserRole,
  getManagedDepartmentIds,
} from "@/lib/auth-utils";
import { getDepartmentPathMap } from "@/lib/department-tree";
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
    // Pending: only show requests from direct department members (not sub-departments)
    // For manager: members of the departments they directly manage
    // For admin: all requests except their own
    let pendingApplicantFilter: { in: string[] } | undefined;

    if (role === "manager") {
      // Only direct departments managed by this user (not sub-departments)
      const directDepts = await prisma.department.findMany({
        where: { managerId: user.id },
        select: { id: true },
      });
      const directDeptIds = directDepts.map((d) => d.id);
      const directMembers = await prisma.user.findMany({
        where: { departmentId: { in: directDeptIds } },
        select: { id: true },
      });
      const directMemberIds = directMembers
        .map((s) => s.id)
        .filter((id) => id !== user.id);
      pendingApplicantFilter = { in: directMemberIds };
    }

    const pendingWhere = pendingApplicantFilter
      ? { applicantId: pendingApplicantFilter }
      : { applicantId: { not: user.id } };

    pendingRequests = await prisma.approvalRequest.findMany({
      where: {
        ...pendingWhere,
        status: ApprovalStatus.PENDING,
      },
      include: {
        applicant: {
          select: { name: true, departmentId: true, department: { select: { name: true } } },
        },
        workYear: { select: { name: true } },
        approver: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // History: admin sees all, manager sees department + sub-departments
    let historyWhere: Record<string, unknown>;

    if (role === "admin") {
      historyWhere = {
        status: { in: [ApprovalStatus.APPROVED, ApprovalStatus.REJECTED] },
      };
    } else {
      // Manager: see records from their department and sub-departments
      const deptIds = await getManagedDepartmentIds(user.id);
      const allMembers = await prisma.user.findMany({
        where: { departmentId: { in: deptIds } },
        select: { id: true },
      });
      const allMemberIds = allMembers
        .map((s) => s.id)
        .filter((id) => id !== user.id);
      historyWhere = {
        applicantId: { in: allMemberIds },
        status: { in: [ApprovalStatus.APPROVED, ApprovalStatus.REJECTED] },
      };
    }

    processedRequests = await prisma.approvalRequest.findMany({
      where: historyWhere,
      include: {
        applicant: {
          select: { name: true, departmentId: true, department: { select: { name: true } } },
        },
        workYear: { select: { name: true } },
        approver: { select: { name: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  // Build department path map for full path display
  const pathMap = await getDepartmentPathMap();

  // Replace department names with full paths
  const replaceDeptName = (records: typeof pendingRequests) => {
    for (const r of records) {
      const applicant = r as unknown as { applicant?: { departmentId?: string; department?: { name: string } | null } };
      if (applicant.applicant?.department && applicant.applicant?.departmentId) {
        applicant.applicant.department.name =
          pathMap.get(applicant.applicant.departmentId) ?? applicant.applicant.department.name;
      }
    }
  };

  replaceDeptName(pendingRequests);
  replaceDeptName(processedRequests);

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
