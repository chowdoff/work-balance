# Pagination & Employee Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add server-side pagination (20 per page) and an employee filter (linked to department filter) to the overtime and leave record pages.

**Architecture:** Both pages follow the same pattern — `page.tsx` (server) handles searchParams-driven queries with `skip/take` for pagination and `userId` filtering, passing results + pagination metadata to `client.tsx` (client) which renders the filter bar and pagination controls. The overtime page is modified first, then the leave page mirrors the same changes.

**Tech Stack:** Next.js 16 App Router, Prisma 7, existing shadcn components, Tailwind CSS 4.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/app/(main)/overtime/page.tsx` | Modify | Add `page`/`userId` param parsing, `skip/take` pagination, `count` query, pass pagination props |
| `src/app/(main)/overtime/client.tsx` | Modify | Add employee filter select, pagination controls, update `updateFilter` logic |
| `src/app/(main)/leave/page.tsx` | Modify | Same changes as overtime/page.tsx |
| `src/app/(main)/leave/client.tsx` | Modify | Same changes as overtime/client.tsx |

---

### Task 1: Add pagination and userId filter to overtime page.tsx

**Files:**
- Modify: `src/app/(main)/overtime/page.tsx`

- [ ] **Step 1: Update searchParams type and add pagination constants**

In `src/app/(main)/overtime/page.tsx`, replace:

```tsx
export default async function OvertimePage({
  searchParams,
}: {
  searchParams: Promise<{ departmentId?: string; workYearId?: string }>;
}) {
  const user = await getCurrentUser();
  const role = await getUserRole(user.id);

  const params = await searchParams;
```

with:

```tsx
const PAGE_SIZE = 20;

export default async function OvertimePage({
  searchParams,
}: {
  searchParams: Promise<{ departmentId?: string; workYearId?: string; userId?: string; page?: string }>;
}) {
  const user = await getCurrentUser();
  const role = await getUserRole(user.id);

  const params = await searchParams;
  const currentPage = Math.max(1, Number(params.page) || 1);
```

- [ ] **Step 2: Add userId to the record query where clause**

Replace the records query block:

```tsx
  const records = await prisma.overtimeRecord.findMany({
    where: {
      workYearId: selectedWorkYearId,
      userId: { in: filteredUserIds },
    },
    include: {
      user: {
        select: { name: true, departmentId: true, department: { select: { name: true } } },
      },
    },
    orderBy: { date: "desc" },
  });
```

with:

```tsx
  // Apply userId filter if specified
  const recordUserIds = params.userId && filteredUserIds.includes(params.userId)
    ? [params.userId]
    : filteredUserIds;

  const recordWhere = {
    workYearId: selectedWorkYearId,
    userId: { in: recordUserIds },
  };

  const [records, totalCount] = await Promise.all([
    prisma.overtimeRecord.findMany({
      where: recordWhere,
      include: {
        user: {
          select: { name: true, departmentId: true, department: { select: { name: true } } },
        },
      },
      orderBy: { date: "desc" },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.overtimeRecord.count({ where: recordWhere }),
  ]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
```

- [ ] **Step 3: Pass new props to OvertimeClient**

Replace the return statement:

```tsx
  return (
    <OvertimeClient
      records={JSON.parse(JSON.stringify(records))}
      role={role}
      selectedWorkYearId={selectedWorkYearId}
      manageableUsers={manageableUsers}
      tree={tree}
      workYears={workYears.map((w) => ({
        id: w.id,
        name: w.name,
        isCurrent: w.isCurrent,
        startDate: w.startDate.toISOString().slice(0, 10),
        endDate: w.endDate.toISOString().slice(0, 10),
      }))}
      selectedDepartmentId={params.departmentId ?? ""}
    />
  );
```

with:

```tsx
  return (
    <OvertimeClient
      records={JSON.parse(JSON.stringify(records))}
      role={role}
      selectedWorkYearId={selectedWorkYearId}
      manageableUsers={manageableUsers}
      tree={tree}
      workYears={workYears.map((w) => ({
        id: w.id,
        name: w.name,
        isCurrent: w.isCurrent,
        startDate: w.startDate.toISOString().slice(0, 10),
        endDate: w.endDate.toISOString().slice(0, 10),
      }))}
      selectedDepartmentId={params.departmentId ?? ""}
      selectedUserId={params.userId ?? ""}
      page={currentPage}
      totalPages={totalPages}
      totalCount={totalCount}
    />
  );
```

- [ ] **Step 4: Verify build**

Run:
```bash
npx next build 2>&1 | tail -5
```

Expected: Build will fail because OvertimeClient doesn't accept the new props yet. That's OK — Task 2 will fix it.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(main\)/overtime/page.tsx
git commit -m "feat(overtime): add server-side pagination and userId filter to queries"
```

---

### Task 2: Add employee filter and pagination UI to overtime client.tsx

**Files:**
- Modify: `src/app/(main)/overtime/client.tsx`

- [ ] **Step 1: Update Props type to include new fields**

Replace the Props type:

```tsx
type Props = {
  records: OvertimeData[];
  role: UserRole;
  selectedWorkYearId: string;
  manageableUsers: { id: string; name: string }[];
  tree: DepartmentNode[];
  workYears: WorkYear[];
  selectedDepartmentId: string;
};
```

with:

```tsx
type Props = {
  records: OvertimeData[];
  role: UserRole;
  selectedWorkYearId: string;
  manageableUsers: { id: string; name: string }[];
  tree: DepartmentNode[];
  workYears: WorkYear[];
  selectedDepartmentId: string;
  selectedUserId: string;
  page: number;
  totalPages: number;
  totalCount: number;
};
```

- [ ] **Step 2: Update component destructuring and updateFilter function**

Replace:

```tsx
export function OvertimeClient({
  records,
  role,
  selectedWorkYearId,
  manageableUsers,
  tree,
  workYears,
  selectedDepartmentId,
}: Props) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formWorkYearId, setFormWorkYearId] = useState(selectedWorkYearId);

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
```

with:

```tsx
export function OvertimeClient({
  records,
  role,
  selectedWorkYearId,
  manageableUsers,
  tree,
  workYears,
  selectedDepartmentId,
  selectedUserId,
  page,
  totalPages,
  totalCount,
}: Props) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formWorkYearId, setFormWorkYearId] = useState(selectedWorkYearId);

  const canManage = role !== "employee";

  function buildUrl(overrides: Record<string, string>) {
    const state: Record<string, string> = {
      departmentId: selectedDepartmentId,
      userId: selectedUserId,
      workYearId: selectedWorkYearId,
      page: String(page),
    };
    Object.assign(state, overrides);
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(state)) {
      if (v) params.set(k, v);
    }
    return `/overtime?${params.toString()}`;
  }

  function updateFilter(key: string, value: string) {
    if (key === "departmentId") {
      // Clear userId and reset page when department changes
      router.push(buildUrl({ departmentId: value, userId: "", page: "" }));
    } else if (key === "userId") {
      // Reset page when user changes
      router.push(buildUrl({ userId: value, page: "" }));
    } else if (key === "workYearId") {
      // Reset page when work year changes
      router.push(buildUrl({ workYearId: value, page: "" }));
    }
  }

  function goToPage(p: number) {
    router.push(buildUrl({ page: String(p) }));
  }
```

- [ ] **Step 3: Add employee filter select to the filter bar**

Replace the filter bar section:

```tsx
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
```

with:

```tsx
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
              value={selectedUserId}
              onChange={(e) => updateFilter("userId", e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            >
              <option value="">全部员工</option>
              {manageableUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
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
```

- [ ] **Step 4: Add pagination controls after the table**

After the closing `</div>` of the table container (`<div className="border rounded-md overflow-auto">`), and before the final closing `</div>` of the component return, add:

```tsx
      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">共 {totalCount} 条记录</p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1}
            >
              上一页
            </Button>
            {getPaginationPages(page, totalPages).map((p, i) =>
              p === "..." ? (
                <span key={`ellipsis-${i}`} className="px-2 text-sm text-muted-foreground">...</span>
              ) : (
                <Button
                  key={p}
                  variant={p === page ? "default" : "outline"}
                  size="sm"
                  onClick={() => goToPage(p as number)}
                  className="min-w-[36px]"
                >
                  {p}
                </Button>
              )
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages}
            >
              下一页
            </Button>
          </div>
        </div>
      )}
```

- [ ] **Step 5: Add the getPaginationPages helper function**

Add this function inside `client.tsx`, before the `OvertimeClient` component:

```tsx
function getPaginationPages(current: number, total: number): (number | "...")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages: (number | "...")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) pages.push("...");
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < total - 1) pages.push("...");
  pages.push(total);
  return pages;
}
```

- [ ] **Step 6: Verify build**

Run:
```bash
npx next build 2>&1 | tail -5
```

Expected: Build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/app/\(main\)/overtime/page.tsx src/app/\(main\)/overtime/client.tsx
git commit -m "feat(overtime): add employee filter and pagination UI"
```

---

### Task 3: Add pagination and userId filter to leave page.tsx

**Files:**
- Modify: `src/app/(main)/leave/page.tsx`

- [ ] **Step 1: Update searchParams type and add pagination constants**

In `src/app/(main)/leave/page.tsx`, replace:

```tsx
export default async function LeavePage({
  searchParams,
}: {
  searchParams: Promise<{ departmentId?: string; workYearId?: string }>;
}) {
  const user = await getCurrentUser();
  const role = await getUserRole(user.id);

  const params = await searchParams;
```

with:

```tsx
const PAGE_SIZE = 20;

export default async function LeavePage({
  searchParams,
}: {
  searchParams: Promise<{ departmentId?: string; workYearId?: string; userId?: string; page?: string }>;
}) {
  const user = await getCurrentUser();
  const role = await getUserRole(user.id);

  const params = await searchParams;
  const currentPage = Math.max(1, Number(params.page) || 1);
```

- [ ] **Step 2: Add userId to the record query where clause**

Replace the records query block:

```tsx
  const records = await prisma.leaveRecord.findMany({
    where: {
      workYearId: selectedWorkYearId,
      userId: { in: filteredUserIds },
    },
    include: {
      user: {
        select: { name: true, departmentId: true, department: { select: { name: true } } },
      },
    },
    orderBy: { date: "desc" },
  });
```

with:

```tsx
  // Apply userId filter if specified
  const recordUserIds = params.userId && filteredUserIds.includes(params.userId)
    ? [params.userId]
    : filteredUserIds;

  const recordWhere = {
    workYearId: selectedWorkYearId,
    userId: { in: recordUserIds },
  };

  const [records, totalCount] = await Promise.all([
    prisma.leaveRecord.findMany({
      where: recordWhere,
      include: {
        user: {
          select: { name: true, departmentId: true, department: { select: { name: true } } },
        },
      },
      orderBy: { date: "desc" },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.leaveRecord.count({ where: recordWhere }),
  ]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
```

- [ ] **Step 3: Pass new props to LeaveClient**

Replace the return statement:

```tsx
  return (
    <LeaveClient
      records={JSON.parse(JSON.stringify(records))}
      role={role}
      selectedWorkYearId={selectedWorkYearId}
      manageableUsers={manageableUsers}
      tree={tree}
      workYears={workYears.map((w) => ({
        id: w.id,
        name: w.name,
        isCurrent: w.isCurrent,
        startDate: w.startDate.toISOString().slice(0, 10),
        endDate: w.endDate.toISOString().slice(0, 10),
      }))}
      selectedDepartmentId={params.departmentId ?? ""}
    />
  );
```

with:

```tsx
  return (
    <LeaveClient
      records={JSON.parse(JSON.stringify(records))}
      role={role}
      selectedWorkYearId={selectedWorkYearId}
      manageableUsers={manageableUsers}
      tree={tree}
      workYears={workYears.map((w) => ({
        id: w.id,
        name: w.name,
        isCurrent: w.isCurrent,
        startDate: w.startDate.toISOString().slice(0, 10),
        endDate: w.endDate.toISOString().slice(0, 10),
      }))}
      selectedDepartmentId={params.departmentId ?? ""}
      selectedUserId={params.userId ?? ""}
      page={currentPage}
      totalPages={totalPages}
      totalCount={totalCount}
    />
  );
```

- [ ] **Step 4: Commit**

```bash
git add src/app/\(main\)/leave/page.tsx
git commit -m "feat(leave): add server-side pagination and userId filter to queries"
```

---

### Task 4: Add employee filter and pagination UI to leave client.tsx

**Files:**
- Modify: `src/app/(main)/leave/client.tsx`

- [ ] **Step 1: Update Props type to include new fields**

Replace the Props type:

```tsx
type Props = {
  records: LeaveData[];
  role: UserRole;
  selectedWorkYearId: string;
  manageableUsers: { id: string; name: string }[];
  tree: DepartmentNode[];
  workYears: WorkYear[];
  selectedDepartmentId: string;
};
```

with:

```tsx
type Props = {
  records: LeaveData[];
  role: UserRole;
  selectedWorkYearId: string;
  manageableUsers: { id: string; name: string }[];
  tree: DepartmentNode[];
  workYears: WorkYear[];
  selectedDepartmentId: string;
  selectedUserId: string;
  page: number;
  totalPages: number;
  totalCount: number;
};
```

- [ ] **Step 2: Add getPaginationPages helper before LeaveClient**

Add this function before the `LeaveClient` component (after the `LEAVE_TYPE_LABELS` constant):

```tsx
function getPaginationPages(current: number, total: number): (number | "...")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages: (number | "...")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) pages.push("...");
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < total - 1) pages.push("...");
  pages.push(total);
  return pages;
}
```

- [ ] **Step 3: Update component destructuring and updateFilter function**

Replace:

```tsx
export function LeaveClient({
  records,
  role,
  selectedWorkYearId,
  manageableUsers,
  tree,
  workYears,
  selectedDepartmentId,
}: Props) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formWorkYearId, setFormWorkYearId] = useState(selectedWorkYearId);

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
```

with:

```tsx
export function LeaveClient({
  records,
  role,
  selectedWorkYearId,
  manageableUsers,
  tree,
  workYears,
  selectedDepartmentId,
  selectedUserId,
  page,
  totalPages,
  totalCount,
}: Props) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formWorkYearId, setFormWorkYearId] = useState(selectedWorkYearId);

  const canManage = role !== "employee";

  function buildUrl(overrides: Record<string, string>) {
    const state: Record<string, string> = {
      departmentId: selectedDepartmentId,
      userId: selectedUserId,
      workYearId: selectedWorkYearId,
      page: String(page),
    };
    Object.assign(state, overrides);
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(state)) {
      if (v) params.set(k, v);
    }
    return `/leave?${params.toString()}`;
  }

  function updateFilter(key: string, value: string) {
    if (key === "departmentId") {
      router.push(buildUrl({ departmentId: value, userId: "", page: "" }));
    } else if (key === "userId") {
      router.push(buildUrl({ userId: value, page: "" }));
    } else if (key === "workYearId") {
      router.push(buildUrl({ workYearId: value, page: "" }));
    }
  }

  function goToPage(p: number) {
    router.push(buildUrl({ page: String(p) }));
  }
```

- [ ] **Step 4: Add employee filter select to the filter bar**

Replace the filter bar section:

```tsx
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
```

with:

```tsx
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
              value={selectedUserId}
              onChange={(e) => updateFilter("userId", e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            >
              <option value="">全部员工</option>
              {manageableUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
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
```

- [ ] **Step 5: Add pagination controls after the table**

After the closing `</div>` of the table container (`<div className="border rounded-md overflow-auto">`), and before the final closing `</div>` of the component return, add:

```tsx
      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">共 {totalCount} 条记录</p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1}
            >
              上一页
            </Button>
            {getPaginationPages(page, totalPages).map((p, i) =>
              p === "..." ? (
                <span key={`ellipsis-${i}`} className="px-2 text-sm text-muted-foreground">...</span>
              ) : (
                <Button
                  key={p}
                  variant={p === page ? "default" : "outline"}
                  size="sm"
                  onClick={() => goToPage(p as number)}
                  className="min-w-[36px]"
                >
                  {p}
                </Button>
              )
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages}
            >
              下一页
            </Button>
          </div>
        </div>
      )}
```

- [ ] **Step 6: Verify build**

Run:
```bash
npx next build 2>&1 | tail -5
```

Expected: Build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/app/\(main\)/leave/page.tsx src/app/\(main\)/leave/client.tsx
git commit -m "feat(leave): add employee filter and pagination UI"
```

---

### Task 5: Lint check and final verification

**Files:**
- All modified files

- [ ] **Step 1: Run lint**

Run:
```bash
npm run lint -- --ignore-pattern pgdata
```

Expected: No new errors (existing navbar img warning is OK).

- [ ] **Step 2: Run production build**

Run:
```bash
npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 3: Fix any lint or build errors if found**

- [ ] **Step 4: Commit fixes if any**

```bash
git add -A
git commit -m "fix: resolve lint and build issues for pagination feature"
```

Only run this step if there were fixes needed.
