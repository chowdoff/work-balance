# 加班/请假记录页面筛选器 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add department column, department filter, and work year filter to the overtime and leave record pages, using URL searchParams (matching the statistics page pattern).

**Architecture:** Server components (`page.tsx`) accept `searchParams`, query filtered data, and pass results + filter state to client components. Client components render filters and use `router.push` to update URL on filter change. The pattern is identical to the existing statistics page.

**Tech Stack:** Next.js Server Components, Prisma, DepartmentTreeSelect component, URL searchParams

---

### Task 1: Overtime page.tsx — add searchParams, filters, and department data

**Files:**
- Modify: `src/app/(main)/overtime/page.tsx`

- [ ] **Step 1: Rewrite overtime page.tsx**

Replace the entire content of `src/app/(main)/overtime/page.tsx` with:

```typescript
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

  const selectedWorkYear = workYears.find((w) => w.id === selectedWorkYearId)!;

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
      workYearStartDate={selectedWorkYear.startDate.toISOString().slice(0, 10)}
      workYearEndDate={selectedWorkYear.endDate.toISOString().slice(0, 10)}
      tree={tree}
      workYears={JSON.parse(JSON.stringify(workYears))}
      selectedDepartmentId={params.departmentId ?? ""}
    />
  );
}
```

Key changes from the current version:
- Function signature accepts `searchParams`
- Queries all work years (not just `isCurrent`)
- Uses `getAccessibleDepartmentTree` for department filter (empty for employees)
- Uses `getManagedDepartmentIds` for backend permission filtering (same pattern as statistics page)
- Queries user IDs first, then records by those user IDs (allows department-based filtering)
- `include` now has `user.department`
- Passes `tree`, `workYears`, `selectedDepartmentId`, `selectedWorkYearId` to client
- Removes `currentWorkYearName` prop (replaced by year selector)
- Renames `currentWorkYearId` to `selectedWorkYearId`

- [ ] **Step 2: Verify the app builds**

Run: `npx next build 2>&1 | tail -20`
Expected: Build will FAIL because client.tsx Props don't match yet. That's expected — Task 2 fixes the client.

- [ ] **Step 3: Commit**

```bash
git add src/app/(main)/overtime/page.tsx
git commit -m "feat: add searchParams, department tree, and year filter to overtime page"
```

Note: Build may fail at this point since client Props are not yet updated. This is acceptable — Task 2 completes the pair.

---

### Task 2: Overtime client.tsx — add filters UI and department column

**Files:**
- Modify: `src/app/(main)/overtime/client.tsx`

- [ ] **Step 1: Rewrite overtime client.tsx**

Replace the entire content of `src/app/(main)/overtime/client.tsx` with:

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
import { DepartmentTreeSelect } from "@/components/department-tree-select";
import type { DepartmentNode } from "@/lib/department-tree";
import type { UserRole } from "@/lib/auth-utils";
import { createOvertime, updateOvertime, deleteOvertime } from "./actions";

type OvertimeData = {
  id: string;
  userId: string;
  workYearId: string;
  date: string;
  days: string;
  remark: string | null;
  user: { name: string; department: { name: string } | null };
};

type WorkYear = {
  id: string;
  name: string;
  isCurrent: boolean;
};

type Props = {
  records: OvertimeData[];
  role: UserRole;
  selectedWorkYearId: string;
  manageableUsers: { id: string; name: string }[];
  workYearStartDate: string;
  workYearEndDate: string;
  tree: DepartmentNode[];
  workYears: WorkYear[];
  selectedDepartmentId: string;
};

export function OvertimeClient({
  records,
  role,
  selectedWorkYearId,
  manageableUsers,
  workYearStartDate,
  workYearEndDate,
  tree,
  workYears,
  selectedDepartmentId,
}: Props) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const canManage = role !== "employee";

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams();
    if (key === "departmentId") {
      if (value) params.set("departmentId", value);
      params.set("workYearId", selectedWorkYearId);
    } else {
      if (selectedDepartmentId) params.set("departmentId", selectedDepartmentId);
      if (value) params.set("workYearId", value);
    }
    router.push(`/overtime?${params.toString()}`);
  }

  function openCreate() {
    setEditingId(null);
    setDialogOpen(true);
  }

  function openEdit(id: string) {
    setEditingId(id);
    setDialogOpen(true);
  }

  const editing = editingId ? records.find((r) => r.id === editingId) ?? null : null;

  async function handleSubmit(formData: FormData) {
    try {
      if (editingId) {
        await updateOvertime(editingId, formData);
      } else {
        await createOvertime(formData);
      }
      setEditingId(null);
      setDialogOpen(false);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("确定要删除此加班记录吗？")) return;
    try {
      await deleteOvertime(id);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">加班记录</h1>
        {canManage && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger
              render={
                <Button onClick={openCreate}>新增加班</Button>
              }
            />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingId ? "编辑加班记录" : "新增加班记录"}</DialogTitle>
              </DialogHeader>
              <form key={editingId ?? "new"} action={handleSubmit} className="space-y-4">
                <input type="hidden" name="workYearId" value={selectedWorkYearId} />
                {!editingId && (
                  <div className="space-y-2">
                    <Label htmlFor="userId">员工</Label>
                    <select
                      id="userId"
                      name="userId"
                      required
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    >
                      <option value="">请选择员工</option>
                      {manageableUsers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="date">日期</Label>
                  <Input
                    id="date"
                    name="date"
                    type="date"
                    defaultValue={editing?.date?.slice(0, 10) ?? ""}
                    min={workYearStartDate}
                    max={workYearEndDate}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="days">加班天数</Label>
                  <Input
                    id="days"
                    name="days"
                    type="number"
                    step="0.5"
                    min="0.5"
                    defaultValue={editing?.days ?? ""}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="remark">备注</Label>
                  <Input
                    id="remark"
                    name="remark"
                    defaultValue={editing?.remark ?? ""}
                  />
                </div>
                <Button type="submit" className="w-full">
                  保存
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {canManage && (
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="w-48">
            <DepartmentTreeSelect
              tree={tree}
              value={selectedDepartmentId}
              onChange={(v) => updateFilter("departmentId", v)}
              allowEmpty
            />
          </div>
          <div className="w-48">
            <select
              value={selectedWorkYearId}
              onChange={(e) => updateFilter("workYearId", e.target.value)}
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
        </div>
      )}

      <div className="border rounded-md overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>员工</TableHead>
              <TableHead>部门</TableHead>
              <TableHead>日期</TableHead>
              <TableHead className="text-right">天数</TableHead>
              <TableHead>备注</TableHead>
              {canManage && <TableHead className="text-right">操作</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={canManage ? 6 : 5}
                  className="text-center text-muted-foreground py-8"
                >
                  暂无加班记录
                </TableCell>
              </TableRow>
            )}
            {records.map((record) => (
              <TableRow key={record.id}>
                <TableCell className="font-medium">{record.user.name}</TableCell>
                <TableCell>{record.user.department?.name ?? "-"}</TableCell>
                <TableCell>{record.date.slice(0, 10)}</TableCell>
                <TableCell className="text-right">{record.days}</TableCell>
                <TableCell className="text-muted-foreground">
                  {record.remark ?? "-"}
                </TableCell>
                {canManage && (
                  <TableCell className="text-right">
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEdit(record.id)}
                      >
                        编辑
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(record.id)}
                      >
                        删除
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
```

Key changes from the current version:
- New imports: `useRouter`, `DepartmentTreeSelect`, `DepartmentNode`
- `OvertimeData.user` now includes `department: { name: string } | null`
- New `WorkYear` type
- Props: removed `currentWorkYearId`/`currentWorkYearName`, added `selectedWorkYearId`, `tree`, `workYears`, `selectedDepartmentId`
- Added `updateFilter` function (same pattern as statistics page)
- Removed subtitle `<p>` showing year name (replaced by year selector)
- Added filter bar with `DepartmentTreeSelect` and year `<select>` (only for non-employee)
- Table: added "部门" column after "员工", updated colSpan from 5/4 to 6/5
- Form hidden field uses `selectedWorkYearId` instead of `currentWorkYearId`

- [ ] **Step 2: Verify the app builds**

Run: `npx next build 2>&1 | tail -20`
Expected: Build succeeds without errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/(main)/overtime/page.tsx src/app/(main)/overtime/client.tsx
git commit -m "feat: add department column and filters to overtime page"
```

---

### Task 3: Leave page.tsx — add searchParams, filters, and department data

**Files:**
- Modify: `src/app/(main)/leave/page.tsx`

- [ ] **Step 1: Rewrite leave page.tsx**

Replace the entire content of `src/app/(main)/leave/page.tsx` with:

```typescript
import { prisma } from "@/lib/prisma";
import { getCurrentUser, getUserRole, getManagedDepartmentIds } from "@/lib/auth-utils";
import { getAccessibleDepartmentTree } from "@/lib/department-tree";
import { LeaveClient } from "./client";

export default async function LeavePage({
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

  const selectedWorkYear = workYears.find((w) => w.id === selectedWorkYearId)!;

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
      userFilter = { id: "none" };
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

  const records = await prisma.leaveRecord.findMany({
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
    <LeaveClient
      records={JSON.parse(JSON.stringify(records))}
      role={role}
      selectedWorkYearId={selectedWorkYearId}
      manageableUsers={manageableUsers}
      workYearStartDate={selectedWorkYear.startDate.toISOString().slice(0, 10)}
      workYearEndDate={selectedWorkYear.endDate.toISOString().slice(0, 10)}
      tree={tree}
      workYears={JSON.parse(JSON.stringify(workYears))}
      selectedDepartmentId={params.departmentId ?? ""}
    />
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/(main)/leave/page.tsx
git commit -m "feat: add searchParams, department tree, and year filter to leave page"
```

---

### Task 4: Leave client.tsx — add filters UI and department column

**Files:**
- Modify: `src/app/(main)/leave/client.tsx`

- [ ] **Step 1: Rewrite leave client.tsx**

Replace the entire content of `src/app/(main)/leave/client.tsx` with:

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
import { DepartmentTreeSelect } from "@/components/department-tree-select";
import type { DepartmentNode } from "@/lib/department-tree";
import type { UserRole } from "@/lib/auth-utils";
import { createLeave, updateLeave, deleteLeave } from "./actions";

type LeaveData = {
  id: string;
  userId: string;
  workYearId: string;
  type: "COMPENSATORY" | "ANNUAL";
  date: string;
  days: string;
  remark: string | null;
  user: { name: string; department: { name: string } | null };
};

type WorkYear = {
  id: string;
  name: string;
  isCurrent: boolean;
};

type Props = {
  records: LeaveData[];
  role: UserRole;
  selectedWorkYearId: string;
  manageableUsers: { id: string; name: string }[];
  workYearStartDate: string;
  workYearEndDate: string;
  tree: DepartmentNode[];
  workYears: WorkYear[];
  selectedDepartmentId: string;
};

const LEAVE_TYPE_LABELS: Record<string, string> = {
  COMPENSATORY: "调休",
  ANNUAL: "年假",
};

export function LeaveClient({
  records,
  role,
  selectedWorkYearId,
  manageableUsers,
  workYearStartDate,
  workYearEndDate,
  tree,
  workYears,
  selectedDepartmentId,
}: Props) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const canManage = role !== "employee";

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams();
    if (key === "departmentId") {
      if (value) params.set("departmentId", value);
      params.set("workYearId", selectedWorkYearId);
    } else {
      if (selectedDepartmentId) params.set("departmentId", selectedDepartmentId);
      if (value) params.set("workYearId", value);
    }
    router.push(`/leave?${params.toString()}`);
  }

  function openCreate() {
    setEditingId(null);
    setDialogOpen(true);
  }

  function openEdit(id: string) {
    setEditingId(id);
    setDialogOpen(true);
  }

  const editing = editingId ? records.find((r) => r.id === editingId) ?? null : null;

  async function handleSubmit(formData: FormData) {
    try {
      if (editingId) {
        await updateLeave(editingId, formData);
      } else {
        await createLeave(formData);
      }
      setEditingId(null);
      setDialogOpen(false);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("确定要删除此请假记录吗？")) return;
    try {
      await deleteLeave(id);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">请假记录</h1>
        {canManage && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger
              render={
                <Button onClick={openCreate}>新增请假</Button>
              }
            />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingId ? "编辑请假记录" : "新增请假记录"}</DialogTitle>
              </DialogHeader>
              <form key={editingId ?? "new"} action={handleSubmit} className="space-y-4">
                <input type="hidden" name="workYearId" value={selectedWorkYearId} />
                {!editingId && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="userId">员工</Label>
                      <select
                        id="userId"
                        name="userId"
                        required
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                      >
                        <option value="">请选择员工</option>
                        {manageableUsers.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="type">假期类型</Label>
                      <select
                        id="type"
                        name="type"
                        required
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                      >
                        <option value="">请选择类型</option>
                        <option value="COMPENSATORY">调休</option>
                        <option value="ANNUAL">年假</option>
                      </select>
                    </div>
                  </>
                )}
                <div className="space-y-2">
                  <Label htmlFor="date">日期</Label>
                  <Input
                    id="date"
                    name="date"
                    type="date"
                    defaultValue={editing?.date?.slice(0, 10) ?? ""}
                    min={workYearStartDate}
                    max={workYearEndDate}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="days">请假天数</Label>
                  <Input
                    id="days"
                    name="days"
                    type="number"
                    step="0.5"
                    min="0.5"
                    defaultValue={editing?.days ?? ""}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="remark">备注</Label>
                  <Input
                    id="remark"
                    name="remark"
                    defaultValue={editing?.remark ?? ""}
                  />
                </div>
                <Button type="submit" className="w-full">
                  保存
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {canManage && (
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="w-48">
            <DepartmentTreeSelect
              tree={tree}
              value={selectedDepartmentId}
              onChange={(v) => updateFilter("departmentId", v)}
              allowEmpty
            />
          </div>
          <div className="w-48">
            <select
              value={selectedWorkYearId}
              onChange={(e) => updateFilter("workYearId", e.target.value)}
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
        </div>
      )}

      <div className="border rounded-md overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>员工</TableHead>
              <TableHead>部门</TableHead>
              <TableHead>类型</TableHead>
              <TableHead>日期</TableHead>
              <TableHead className="text-right">天数</TableHead>
              <TableHead>备注</TableHead>
              {canManage && <TableHead className="text-right">操作</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={canManage ? 7 : 6}
                  className="text-center text-muted-foreground py-8"
                >
                  暂无请假记录
                </TableCell>
              </TableRow>
            )}
            {records.map((record) => (
              <TableRow key={record.id}>
                <TableCell className="font-medium">{record.user.name}</TableCell>
                <TableCell>{record.user.department?.name ?? "-"}</TableCell>
                <TableCell>
                  <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold">
                    {LEAVE_TYPE_LABELS[record.type] ?? record.type}
                  </span>
                </TableCell>
                <TableCell>{record.date.slice(0, 10)}</TableCell>
                <TableCell className="text-right">{record.days}</TableCell>
                <TableCell className="text-muted-foreground">
                  {record.remark ?? "-"}
                </TableCell>
                {canManage && (
                  <TableCell className="text-right">
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEdit(record.id)}
                      >
                        编辑
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(record.id)}
                      >
                        删除
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
```

Key changes from the current version (same pattern as overtime):
- New imports: `useRouter`, `DepartmentTreeSelect`, `DepartmentNode`
- `LeaveData.user` now includes `department: { name: string } | null`
- New `WorkYear` type
- Props: removed `currentWorkYearId`/`currentWorkYearName`, added `selectedWorkYearId`, `tree`, `workYears`, `selectedDepartmentId`
- Added `updateFilter` function (URL points to `/leave?...`)
- Removed subtitle `<p>` showing year name
- Added filter bar (same as overtime)
- Table: added "部门" column after "员工", updated colSpan from 6/5 to 7/6
- Form hidden field uses `selectedWorkYearId`

- [ ] **Step 2: Verify the app builds**

Run: `npx next build 2>&1 | tail -20`
Expected: Build succeeds without errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/(main)/leave/page.tsx src/app/(main)/leave/client.tsx
git commit -m "feat: add department column and filters to leave page"
```
