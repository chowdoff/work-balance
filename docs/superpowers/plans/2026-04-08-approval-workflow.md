# Approval Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an approval workflow so employees can submit overtime/leave requests that department managers approve, while preserving the existing direct-entry flow for admin/manager.

**Architecture:** A new `ApprovalRequest` model stores all requests and their lifecycle (PENDING → APPROVED/REJECTED/WITHDRAWN). Approval triggers creation of `OvertimeRecord`/`LeaveRecord` via existing functions. Leave requests pre-deduct balance on submission; the balance recalculation functions are updated to account for pending requests.

**Tech Stack:** Next.js 16 (App Router), React 19, Prisma 7, PostgreSQL, Base UI (shadcn), TypeScript 5

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `prisma/schema.prisma` (modify) | Add `ApprovalType`, `ApprovalStatus` enums + `ApprovalRequest` model + reverse relations |
| Modify | `src/lib/balance.ts` | Include PENDING leave requests in `used` calculation |
| Create | `src/lib/approval.ts` | Approver resolution: find department manager or walk up parent chain |
| Create | `src/app/(main)/approval/actions.ts` | Server Actions: submit, withdraw, approve, reject |
| Create | `src/app/(main)/approval/page.tsx` | Server component: fetch data for all tabs |
| Create | `src/app/(main)/approval/client.tsx` | Client component: tabs, tables, forms, dialogs |
| Modify | `src/components/navbar.tsx` | Add "审批管理" nav item + pending count badge |
| Modify | `src/app/(main)/layout.tsx` | Query pending approval count, pass to Navbar |

---

## Task 1: Database Schema — Add ApprovalRequest Model

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add enums and model to schema**

Add at the end of `prisma/schema.prisma`, before the closing (after `SystemConfig` model):

```prisma
enum ApprovalType {
  OVERTIME
  LEAVE
}

enum ApprovalStatus {
  PENDING
  APPROVED
  REJECTED
  WITHDRAWN
}

model ApprovalRequest {
  id           String         @id @default(cuid())
  type         ApprovalType
  status       ApprovalStatus @default(PENDING)

  applicantId  String
  applicant    User           @relation("Applicant", fields: [applicantId], references: [id])

  approverId   String?
  approver     User?          @relation("Approver", fields: [approverId], references: [id])

  workYearId   String
  workYear     WorkYear       @relation(fields: [workYearId], references: [id])
  date         DateTime
  days         Decimal        @db.Decimal(3, 1)
  leaveType    LeaveType?
  remark       String?
  rejectReason String?

  overtimeRecordId String?          @unique
  overtimeRecord   OvertimeRecord?  @relation(fields: [overtimeRecordId], references: [id])
  leaveRecordId    String?          @unique
  leaveRecord      LeaveRecord?     @relation(fields: [leaveRecordId], references: [id])

  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt
}
```

- [ ] **Step 2: Add reverse relations to existing models**

In the `User` model, add after the `leaveBalances` line:

```prisma
  appliedRequests    ApprovalRequest[] @relation("Applicant")
  approvedRequests   ApprovalRequest[] @relation("Approver")
```

In the `WorkYear` model, add after the `leaveBalances` line:

```prisma
  approvalRequests   ApprovalRequest[]
```

In the `OvertimeRecord` model, add after the `workYear` line:

```prisma
  approvalRequest    ApprovalRequest?
```

In the `LeaveRecord` model, add after the `workYear` line:

```prisma
  approvalRequest    ApprovalRequest?
```

- [ ] **Step 3: Run migration**

```bash
npx prisma migrate dev --name add-approval-request
```

Expected: Migration created successfully, no errors.

- [ ] **Step 4: Commit**

```bash
git add prisma/
git commit -m "feat(schema): add ApprovalRequest model with enums and relations"
```

---

## Task 2: Approver Resolution Logic

**Files:**
- Create: `src/lib/approval.ts`

- [ ] **Step 1: Create the approver resolution utility**

Create `src/lib/approval.ts`:

```typescript
import { prisma } from "@/lib/prisma";

/**
 * Find the approver for a given user by walking up the department tree.
 * Returns the managerId of the user's department, or the first ancestor
 * department that has a manager. Returns null if no manager is found
 * (only admin can approve in that case).
 */
export async function findApproverIds(userId: string): Promise<string[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { departmentId: true },
  });

  if (!user?.departmentId) return [];

  // Walk up the department chain to find a manager
  let currentDeptId: string | null = user.departmentId;

  while (currentDeptId) {
    const dept = await prisma.department.findUnique({
      where: { id: currentDeptId },
      select: { managerId: true, parentId: true },
    });

    if (!dept) break;

    if (dept.managerId) {
      return [dept.managerId];
    }

    currentDeptId = dept.parentId;
  }

  return [];
}

/**
 * Check if a user can approve a given request.
 * Rules:
 * - Admin can approve any request
 * - Department manager (or ancestor manager) can approve their subordinates' requests
 */
export async function canUserApprove(
  approverId: string,
  applicantId: string
): Promise<boolean> {
  // Check if approver is admin
  const approver = await prisma.user.findUnique({
    where: { id: approverId },
    select: { isAdmin: true },
  });

  if (approver?.isAdmin) return true;

  // Check if approver is in the applicant's manager chain
  const approverIds = await findApproverIds(applicantId);
  return approverIds.includes(approverId);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/approval.ts
git commit -m "feat: add approver resolution logic"
```

---

## Task 3: Update Balance Calculation to Include Pending Requests

**Files:**
- Modify: `src/lib/balance.ts:1-36` (recalculateCompensatoryBalance)
- Modify: `src/lib/balance.ts:38-72` (recalculateAnnualBalance)

- [ ] **Step 1: Update recalculateCompensatoryBalance**

In `src/lib/balance.ts`, add the import at the top (after existing imports):

```typescript
import { ApprovalStatus, ApprovalType } from "@prisma/client";
```

Replace the `recalculateCompensatoryBalance` function body. The new version adds pending leave request days to `used`:

```typescript
export async function recalculateCompensatoryBalance(
  userId: string,
  workYearId: string
) {
  const overtimeAgg = await prisma.overtimeRecord.aggregate({
    where: { userId, workYearId },
    _sum: { days: true },
  });

  const leaveAgg = await prisma.leaveRecord.aggregate({
    where: { userId, workYearId, type: LeaveType.COMPENSATORY },
    _sum: { days: true },
  });

  // Include pending leave requests in used calculation
  const pendingAgg = await prisma.approvalRequest.aggregate({
    where: {
      applicantId: userId,
      workYearId,
      type: ApprovalType.LEAVE,
      leaveType: LeaveType.COMPENSATORY,
      status: ApprovalStatus.PENDING,
    },
    _sum: { days: true },
  });

  const total = overtimeAgg._sum.days ?? new Prisma.Decimal(0);
  const effectiveUsed = leaveAgg._sum.days ?? new Prisma.Decimal(0);
  const pendingUsed = pendingAgg._sum.days ?? new Prisma.Decimal(0);
  const used = effectiveUsed.add(pendingUsed);
  const remaining = total.sub(used);

  await prisma.leaveBalance.upsert({
    where: {
      userId_workYearId_type: { userId, workYearId, type: LeaveType.COMPENSATORY },
    },
    update: { total, used, remaining },
    create: {
      userId,
      workYearId,
      type: LeaveType.COMPENSATORY,
      total,
      used,
      remaining,
    },
  });
}
```

- [ ] **Step 2: Update recalculateAnnualBalance**

Replace the `recalculateAnnualBalance` function body:

```typescript
export async function recalculateAnnualBalance(
  userId: string,
  workYearId: string
) {
  const existing = await prisma.leaveBalance.findUnique({
    where: {
      userId_workYearId_type: { userId, workYearId, type: LeaveType.ANNUAL },
    },
  });

  const total = existing?.total ?? new Prisma.Decimal(0);

  const leaveAgg = await prisma.leaveRecord.aggregate({
    where: { userId, workYearId, type: LeaveType.ANNUAL },
    _sum: { days: true },
  });

  // Include pending leave requests in used calculation
  const pendingAgg = await prisma.approvalRequest.aggregate({
    where: {
      applicantId: userId,
      workYearId,
      type: ApprovalType.LEAVE,
      leaveType: LeaveType.ANNUAL,
      status: ApprovalStatus.PENDING,
    },
    _sum: { days: true },
  });

  const effectiveUsed = leaveAgg._sum.days ?? new Prisma.Decimal(0);
  const pendingUsed = pendingAgg._sum.days ?? new Prisma.Decimal(0);
  const used = effectiveUsed.add(pendingUsed);
  const remaining = total.sub(used);

  await prisma.leaveBalance.upsert({
    where: {
      userId_workYearId_type: { userId, workYearId, type: LeaveType.ANNUAL },
    },
    update: { used, remaining },
    create: {
      userId,
      workYearId,
      type: LeaveType.ANNUAL,
      total,
      used,
      remaining,
    },
  });
}
```

- [ ] **Step 3: Verify build**

```bash
npx next build 2>&1 | tail -5
```

Expected: Build succeeds (or only pre-existing warnings).

- [ ] **Step 4: Commit**

```bash
git add src/lib/balance.ts
git commit -m "feat(balance): include pending approval requests in used calculation"
```

---

## Task 4: Server Actions for Approval Workflow

**Files:**
- Create: `src/app/(main)/approval/actions.ts`

- [ ] **Step 1: Create the actions file with submitRequest**

Create `src/app/(main)/approval/actions.ts`:

```typescript
"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser, getUserRole } from "@/lib/auth-utils";
import { canUserApprove } from "@/lib/approval";
import {
  recalculateCompensatoryBalance,
  recalculateAnnualBalance,
} from "@/lib/balance";
import {
  ApprovalType,
  ApprovalStatus,
  LeaveType,
  Prisma,
} from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function submitRequest(formData: FormData) {
  const currentUser = await getCurrentUser();
  const type = formData.get("type") as string;
  const workYearId = formData.get("workYearId") as string;
  const date = formData.get("date") as string;
  const days = parseFloat(formData.get("days") as string);
  const remark = (formData.get("remark") as string) || null;
  const leaveType = formData.get("leaveType") as LeaveType | null;

  // Validate work year
  const workYear = await prisma.workYear.findUnique({
    where: { id: workYearId },
  });
  if (!workYear) throw new Error("工作年度不存在");

  const dateObj = new Date(date);
  if (dateObj < workYear.startDate || dateObj > workYear.endDate) {
    const start = workYear.startDate.toISOString().slice(0, 10);
    const end = workYear.endDate.toISOString().slice(0, 10);
    throw new Error(`日期必须在工作年度范围内（${start} ~ ${end}）`);
  }

  const approvalType =
    type === "OVERTIME" ? ApprovalType.OVERTIME : ApprovalType.LEAVE;

  // For leave requests, check balance and pre-deduct
  if (approvalType === ApprovalType.LEAVE) {
    if (!leaveType) throw new Error("请选择假期类型");

    const balance = await prisma.leaveBalance.findUnique({
      where: {
        userId_workYearId_type: {
          userId: currentUser.id,
          workYearId,
          type: leaveType,
        },
      },
    });

    const remaining = balance?.remaining ?? new Prisma.Decimal(0);
    if (remaining.lt(new Prisma.Decimal(days))) {
      throw new Error(`额度不足，剩余 ${remaining} 天`);
    }
  }

  await prisma.approvalRequest.create({
    data: {
      type: approvalType,
      applicantId: currentUser.id,
      workYearId,
      date: new Date(date),
      days,
      leaveType: approvalType === ApprovalType.LEAVE ? leaveType : null,
      remark,
    },
  });

  // Pre-deduct leave balance by recalculating (includes PENDING requests)
  if (approvalType === ApprovalType.LEAVE && leaveType) {
    if (leaveType === LeaveType.COMPENSATORY) {
      await recalculateCompensatoryBalance(currentUser.id, workYearId);
    } else {
      await recalculateAnnualBalance(currentUser.id, workYearId);
    }
  }

  revalidatePath("/approval");
  revalidatePath("/dashboard");
}

export async function withdrawRequest(id: string) {
  const currentUser = await getCurrentUser();

  const request = await prisma.approvalRequest.findUnique({
    where: { id },
  });
  if (!request) throw new Error("申请不存在");
  if (request.applicantId !== currentUser.id) throw new Error("无权操作");
  if (request.status !== ApprovalStatus.PENDING) {
    throw new Error("只能撤回待审批的申请");
  }

  await prisma.approvalRequest.update({
    where: { id },
    data: { status: ApprovalStatus.WITHDRAWN },
  });

  // Release pre-deducted leave balance
  if (request.type === ApprovalType.LEAVE && request.leaveType) {
    if (request.leaveType === LeaveType.COMPENSATORY) {
      await recalculateCompensatoryBalance(
        request.applicantId,
        request.workYearId
      );
    } else {
      await recalculateAnnualBalance(
        request.applicantId,
        request.workYearId
      );
    }
  }

  revalidatePath("/approval");
  revalidatePath("/dashboard");
}

export async function approveRequest(id: string) {
  const currentUser = await getCurrentUser();

  const request = await prisma.approvalRequest.findUnique({
    where: { id },
  });
  if (!request) throw new Error("申请不存在");
  if (request.status !== ApprovalStatus.PENDING) {
    throw new Error("该申请已处理");
  }

  const canApprove = await canUserApprove(currentUser.id, request.applicantId);
  if (!canApprove) throw new Error("无权审批此申请");

  if (request.type === ApprovalType.OVERTIME) {
    // Create overtime record
    const record = await prisma.overtimeRecord.create({
      data: {
        userId: request.applicantId,
        workYearId: request.workYearId,
        date: request.date,
        days: request.days,
        remark: request.remark,
      },
    });

    await prisma.approvalRequest.update({
      where: { id },
      data: {
        status: ApprovalStatus.APPROVED,
        approverId: currentUser.id,
        overtimeRecordId: record.id,
      },
    });

    await recalculateCompensatoryBalance(
      request.applicantId,
      request.workYearId
    );
  } else {
    // Create leave record
    const record = await prisma.leaveRecord.create({
      data: {
        userId: request.applicantId,
        workYearId: request.workYearId,
        type: request.leaveType!,
        date: request.date,
        days: request.days,
        remark: request.remark,
      },
    });

    await prisma.approvalRequest.update({
      where: { id },
      data: {
        status: ApprovalStatus.APPROVED,
        approverId: currentUser.id,
        leaveRecordId: record.id,
      },
    });

    // Recalculate: pending count decreases, effective count increases — net used stays same
    if (request.leaveType === LeaveType.COMPENSATORY) {
      await recalculateCompensatoryBalance(
        request.applicantId,
        request.workYearId
      );
    } else {
      await recalculateAnnualBalance(
        request.applicantId,
        request.workYearId
      );
    }
  }

  revalidatePath("/approval");
  revalidatePath("/overtime");
  revalidatePath("/leave");
  revalidatePath("/dashboard");
}

export async function rejectRequest(id: string, formData: FormData) {
  const currentUser = await getCurrentUser();
  const rejectReason = (formData.get("rejectReason") as string) || null;

  const request = await prisma.approvalRequest.findUnique({
    where: { id },
  });
  if (!request) throw new Error("申请不存在");
  if (request.status !== ApprovalStatus.PENDING) {
    throw new Error("该申请已处理");
  }

  const canApprove = await canUserApprove(currentUser.id, request.applicantId);
  if (!canApprove) throw new Error("无权审批此申请");

  await prisma.approvalRequest.update({
    where: { id },
    data: {
      status: ApprovalStatus.REJECTED,
      approverId: currentUser.id,
      rejectReason,
    },
  });

  // Release pre-deducted leave balance
  if (request.type === ApprovalType.LEAVE && request.leaveType) {
    if (request.leaveType === LeaveType.COMPENSATORY) {
      await recalculateCompensatoryBalance(
        request.applicantId,
        request.workYearId
      );
    } else {
      await recalculateAnnualBalance(
        request.applicantId,
        request.workYearId
      );
    }
  }

  revalidatePath("/approval");
  revalidatePath("/dashboard");
}
```

- [ ] **Step 2: Verify build**

```bash
npx next build 2>&1 | tail -5
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(main\)/approval/actions.ts
git commit -m "feat(approval): add server actions for submit, withdraw, approve, reject"
```

---

## Task 5: Approval Page — Server Component

**Files:**
- Create: `src/app/(main)/approval/page.tsx`

- [ ] **Step 1: Create the server component**

Create `src/app/(main)/approval/page.tsx`:

```typescript
import { prisma } from "@/lib/prisma";
import {
  getCurrentUser,
  getUserRole,
  getManagedDepartmentIds,
} from "@/lib/auth-utils";
import { findApproverIds } from "@/lib/approval";
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
    // Get applicant IDs this user can approve
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
    // admin: no filter (sees all)

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
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(main\)/approval/page.tsx
git commit -m "feat(approval): add server component for approval page"
```

---

## Task 6: Approval Page — Client Component

**Files:**
- Create: `src/app/(main)/approval/client.tsx`

- [ ] **Step 1: Create the client component**

Create `src/app/(main)/approval/client.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import type { UserRole } from "@/lib/auth-utils";
import {
  submitRequest,
  withdrawRequest,
  approveRequest,
  rejectRequest,
} from "./actions";

type WorkYear = {
  id: string;
  name: string;
  isCurrent: boolean;
  startDate: string;
  endDate: string;
};

type ApprovalRequestData = {
  id: string;
  type: "OVERTIME" | "LEAVE";
  status: "PENDING" | "APPROVED" | "REJECTED" | "WITHDRAWN";
  date: string;
  days: string;
  leaveType: "COMPENSATORY" | "ANNUAL" | null;
  remark: string | null;
  rejectReason: string | null;
  createdAt: string;
  updatedAt: string;
  workYear: { name: string };
  applicant?: { name: string; department: { name: string } | null };
  approver: { name: string } | null;
};

type Props = {
  role: UserRole;
  myRequests: ApprovalRequestData[];
  pendingRequests: ApprovalRequestData[];
  processedRequests: ApprovalRequestData[];
  workYears: WorkYear[];
  currentWorkYearId: string;
  defaultTab: string;
  defaultStatus: string;
};

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  PENDING: { label: "待审批", variant: "outline" },
  APPROVED: { label: "已通过", variant: "default" },
  REJECTED: { label: "已拒绝", variant: "destructive" },
  WITHDRAWN: { label: "已撤回", variant: "secondary" },
};

const TYPE_LABELS: Record<string, string> = {
  OVERTIME: "加班",
  LEAVE: "请假",
};

const LEAVE_TYPE_LABELS: Record<string, string> = {
  COMPENSATORY: "调休",
  ANNUAL: "年假",
};

export function ApprovalClient({
  role,
  myRequests,
  pendingRequests,
  processedRequests,
  workYears,
  currentWorkYearId,
  defaultTab,
  defaultStatus,
}: Props) {
  const router = useRouter();
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [submitType, setSubmitType] = useState<"OVERTIME" | "LEAVE">("OVERTIME");
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState(defaultStatus);
  const [formWorkYearId, setFormWorkYearId] = useState(currentWorkYearId);

  const canApprove = role !== "employee";

  function openSubmitDialog(type: "OVERTIME" | "LEAVE") {
    setSubmitType(type);
    setFormWorkYearId(currentWorkYearId);
    setSubmitDialogOpen(true);
  }

  async function handleSubmit(formData: FormData) {
    formData.set("type", submitType);
    try {
      await submitRequest(formData);
      setSubmitDialogOpen(false);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleWithdraw(id: string) {
    if (!confirm("确定要撤回此申请吗？")) return;
    try {
      await withdrawRequest(id);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleApprove(id: string) {
    if (!confirm("确定要通过此申请吗？")) return;
    try {
      await approveRequest(id);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
    }
  }

  function openRejectDialog(id: string) {
    setRejectingId(id);
    setRejectDialogOpen(true);
  }

  async function handleReject(formData: FormData) {
    if (!rejectingId) return;
    try {
      await rejectRequest(rejectingId, formData);
      setRejectDialogOpen(false);
      setRejectingId(null);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
    }
  }

  function updateStatusFilter(value: string) {
    setStatusFilter(value);
    const params = new URLSearchParams();
    params.set("tab", "my");
    if (value) params.set("status", value);
    router.push(`/approval?${params.toString()}`);
  }

  const filteredMyRequests = statusFilter
    ? myRequests.filter((r) => r.status === statusFilter)
    : myRequests;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">审批管理</h1>
      </div>

      <Tabs defaultValue={defaultTab === "pending" ? "pending" : defaultTab === "history" ? "history" : "my"}>
        <TabsList>
          <TabsTrigger value="my">我的申请</TabsTrigger>
          {canApprove && (
            <TabsTrigger value="pending">
              待我审批
              {pendingRequests.length > 0 && (
                <span className="ml-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">
                  {pendingRequests.length}
                </span>
              )}
            </TabsTrigger>
          )}
          {canApprove && <TabsTrigger value="history">审批记录</TabsTrigger>}
        </TabsList>

        {/* Tab 1: My Requests */}
        <TabsContent value="my">
          <div className="flex flex-wrap items-center gap-4 mb-4 mt-4">
            <Dialog open={submitDialogOpen} onOpenChange={setSubmitDialogOpen}>
              <div className="flex gap-2">
                <DialogTrigger
                  render={
                    <Button
                      variant="outline"
                      onClick={() => openSubmitDialog("OVERTIME")}
                    />
                  }
                >
                  发起加班申请
                </DialogTrigger>
                <DialogTrigger
                  render={
                    <Button onClick={() => openSubmitDialog("LEAVE")} />
                  }
                >
                  发起请假申请
                </DialogTrigger>
              </div>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {submitType === "OVERTIME" ? "发起加班申请" : "发起请假申请"}
                  </DialogTitle>
                </DialogHeader>
                <form key={submitType} action={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="workYearId">工作年度</Label>
                    <select
                      id="workYearId"
                      name="workYearId"
                      value={formWorkYearId}
                      onChange={(e) => setFormWorkYearId(e.target.value)}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    >
                      {workYears.map((wy) => (
                        <option key={wy.id} value={wy.id}>
                          {wy.name}
                          {wy.isCurrent ? " (当前)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  {submitType === "LEAVE" && (
                    <div className="space-y-2">
                      <Label htmlFor="leaveType">假期类型</Label>
                      <select
                        id="leaveType"
                        name="leaveType"
                        required
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                      >
                        <option value="">请选择类型</option>
                        <option value="COMPENSATORY">调休</option>
                        <option value="ANNUAL">年假</option>
                      </select>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="date">日期</Label>
                    <Input
                      id="date"
                      name="date"
                      type="date"
                      min={
                        workYears.find((w) => w.id === formWorkYearId)
                          ?.startDate
                      }
                      max={
                        workYears.find((w) => w.id === formWorkYearId)?.endDate
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="days">
                      {submitType === "OVERTIME" ? "加班天数" : "请假天数"}
                    </Label>
                    <Input
                      id="days"
                      name="days"
                      type="number"
                      step="0.5"
                      min="0.5"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="remark">备注</Label>
                    <Input id="remark" name="remark" />
                  </div>
                  <Button type="submit" className="w-full">
                    提交申请
                  </Button>
                </form>
              </DialogContent>
            </Dialog>

            <div className="ml-auto">
              <select
                value={statusFilter}
                onChange={(e) => updateStatusFilter(e.target.value)}
                className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              >
                <option value="">全部状态</option>
                <option value="PENDING">待审批</option>
                <option value="APPROVED">已通过</option>
                <option value="REJECTED">已拒绝</option>
                <option value="WITHDRAWN">已撤回</option>
              </select>
            </div>
          </div>

          <div className="border rounded-md overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>类型</TableHead>
                  <TableHead>日期</TableHead>
                  <TableHead className="text-right">天数</TableHead>
                  <TableHead>假期类型</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>审批人</TableHead>
                  <TableHead>备注</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMyRequests.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center text-muted-foreground py-8"
                    >
                      暂无申请记录
                    </TableCell>
                  </TableRow>
                )}
                {filteredMyRequests.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell>{TYPE_LABELS[req.type]}</TableCell>
                    <TableCell>{req.date.slice(0, 10)}</TableCell>
                    <TableCell className="text-right">{req.days}</TableCell>
                    <TableCell>
                      {req.leaveType
                        ? LEAVE_TYPE_LABELS[req.leaveType]
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_CONFIG[req.status]?.variant}>
                        {STATUS_CONFIG[req.status]?.label}
                      </Badge>
                    </TableCell>
                    <TableCell>{req.approver?.name ?? "-"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {req.status === "REJECTED" && req.rejectReason
                        ? `拒绝原因: ${req.rejectReason}`
                        : req.remark ?? "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      {req.status === "PENDING" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleWithdraw(req.id)}
                        >
                          撤回
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Tab 2: Pending Approval */}
        {canApprove && (
          <TabsContent value="pending">
            <div className="border rounded-md overflow-auto mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>申请人</TableHead>
                    <TableHead>部门</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>日期</TableHead>
                    <TableHead className="text-right">天数</TableHead>
                    <TableHead>假期类型</TableHead>
                    <TableHead>备注</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingRequests.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="text-center text-muted-foreground py-8"
                      >
                        暂无待审批申请
                      </TableCell>
                    </TableRow>
                  )}
                  {pendingRequests.map((req) => (
                    <TableRow key={req.id}>
                      <TableCell className="font-medium">
                        {req.applicant?.name}
                      </TableCell>
                      <TableCell>
                        {req.applicant?.department?.name ?? "-"}
                      </TableCell>
                      <TableCell>{TYPE_LABELS[req.type]}</TableCell>
                      <TableCell>{req.date.slice(0, 10)}</TableCell>
                      <TableCell className="text-right">{req.days}</TableCell>
                      <TableCell>
                        {req.leaveType
                          ? LEAVE_TYPE_LABELS[req.leaveType]
                          : "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {req.remark ?? "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button
                            size="sm"
                            onClick={() => handleApprove(req.id)}
                          >
                            通过
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => openRejectDialog(req.id)}
                          >
                            拒绝
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Reject Dialog */}
            <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>拒绝申请</DialogTitle>
                </DialogHeader>
                <form action={handleReject} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="rejectReason">拒绝原因</Label>
                    <Input id="rejectReason" name="rejectReason" />
                  </div>
                  <Button type="submit" variant="destructive" className="w-full">
                    确认拒绝
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </TabsContent>
        )}

        {/* Tab 3: Processed History */}
        {canApprove && (
          <TabsContent value="history">
            <div className="border rounded-md overflow-auto mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>申请人</TableHead>
                    <TableHead>部门</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>日期</TableHead>
                    <TableHead className="text-right">天数</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>处理时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {processedRequests.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-center text-muted-foreground py-8"
                      >
                        暂无审批记录
                      </TableCell>
                    </TableRow>
                  )}
                  {processedRequests.map((req) => (
                    <TableRow key={req.id}>
                      <TableCell className="font-medium">
                        {req.applicant?.name}
                      </TableCell>
                      <TableCell>
                        {req.applicant?.department?.name ?? "-"}
                      </TableCell>
                      <TableCell>{TYPE_LABELS[req.type]}</TableCell>
                      <TableCell>{req.date.slice(0, 10)}</TableCell>
                      <TableCell className="text-right">{req.days}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_CONFIG[req.status]?.variant}>
                          {STATUS_CONFIG[req.status]?.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {req.updatedAt.slice(0, 10)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npx next build 2>&1 | tail -5
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(main\)/approval/client.tsx
git commit -m "feat(approval): add client component with tabs, tables, and forms"
```

---

## Task 7: Update Navbar and Layout for Approval Badge

**Files:**
- Modify: `src/components/navbar.tsx:28-35` (navItems array)
- Modify: `src/components/navbar.tsx:70-78` (Navbar props)
- Modify: `src/app/(main)/layout.tsx`

- [ ] **Step 1: Add approval nav item and badge to navbar**

In `src/components/navbar.tsx`, add the "审批管理" item to `navItems` (after the "请假记录" entry):

```typescript
  { label: "审批管理", href: "/approval", roles: ["admin", "manager", "employee"] },
```

Update the `Navbar` props to accept `pendingApprovalCount`:

```typescript
export function Navbar({
  userName,
  userEmail,
  role,
  pendingApprovalCount = 0,
}: {
  userName: string;
  userEmail: string;
  role: UserRole;
  pendingApprovalCount?: number;
}) {
```

In the `NavLinks` component, update the link rendering to show a badge for approval. Change the `NavLinks` function signature to accept the count:

```typescript
function NavLinks({
  items,
  pathname,
  mobile,
  onClose,
  pendingApprovalCount,
}: {
  items: NavItem[];
  pathname: string;
  mobile?: boolean;
  onClose?: () => void;
  pendingApprovalCount: number;
}) {
```

Inside the `NavLinks` map, after `{item.label}`, add the badge conditionally:

```tsx
{item.label}
{item.href === "/approval" && pendingApprovalCount > 0 && (
  <span className="ml-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
    {pendingApprovalCount}
  </span>
)}
```

Pass `pendingApprovalCount` to both `NavLinks` usages in the JSX.

- [ ] **Step 2: Update layout to query pending count**

In `src/app/(main)/layout.tsx`, update to:

```typescript
import { Navbar } from "@/components/navbar";
import { getCurrentUser, getUserRole } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { ApprovalStatus } from "@prisma/client";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  const role = await getUserRole(user.id);

  // Count pending approval requests for badge
  let pendingApprovalCount = 0;
  if (role !== "employee") {
    if (role === "admin") {
      pendingApprovalCount = await prisma.approvalRequest.count({
        where: {
          status: ApprovalStatus.PENDING,
          applicantId: { not: user.id },
        },
      });
    } else {
      // manager: count pending requests from subordinates
      const { getManagedDepartmentIds } = await import("@/lib/auth-utils");
      const deptIds = await getManagedDepartmentIds(user.id);
      const subordinates = await prisma.user.findMany({
        where: { departmentId: { in: deptIds } },
        select: { id: true },
      });
      const subordinateIds = subordinates
        .map((s) => s.id)
        .filter((id) => id !== user.id);
      if (subordinateIds.length > 0) {
        pendingApprovalCount = await prisma.approvalRequest.count({
          where: {
            status: ApprovalStatus.PENDING,
            applicantId: { in: subordinateIds },
          },
        });
      }
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar
        userName={user.name ?? user.email ?? "用户"}
        userEmail={user.email ?? ""}
        role={role}
        pendingApprovalCount={pendingApprovalCount}
      />
      <main className="container mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

```bash
npx next build 2>&1 | tail -5
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/navbar.tsx src/app/\(main\)/layout.tsx
git commit -m "feat(navbar): add approval menu item with pending count badge"
```

---

## Task 8: End-to-End Manual Verification

- [ ] **Step 1: Start dev server and verify pages load**

```bash
npm run dev -- --hostname 0.0.0.0
```

Open in browser:
- Visit `/approval` — should see "我的申请" tab with empty state
- If logged in as admin/manager, should see all 3 tabs

- [ ] **Step 2: Test employee submit flow**

Log in as an employee:
1. Go to `/approval`
2. Click "发起加班申请" → fill form → submit → should appear in "我的申请" as "待审批"
3. Click "发起请假申请" → fill form → submit → should appear, balance should be pre-deducted
4. Click "撤回" on pending leave request → status should change, balance should be restored

- [ ] **Step 3: Test manager approve/reject flow**

Log in as a manager:
1. Go to `/approval` → "待我审批" tab → should see the employee's pending request
2. Click "通过" → should move to "审批记录" tab, overtime/leave record should be created
3. Submit another request as employee, then reject it as manager → balance should be restored

- [ ] **Step 4: Verify navbar badge**

- Log in as manager with pending requests → "审批管理" should show red badge count
- Approve all → badge should disappear

- [ ] **Step 5: Verify existing flows unaffected**

- Go to `/overtime` as admin → direct create/edit/delete still works
- Go to `/leave` as admin → direct create/edit/delete still works
- Dashboard and statistics display correctly

- [ ] **Step 6: Commit any fixes**

If any fixes were needed during testing:

```bash
git add -A
git commit -m "fix(approval): address issues found during manual testing"
```
