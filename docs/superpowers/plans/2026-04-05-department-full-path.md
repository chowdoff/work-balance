# 部门列显示完整路径 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display full department path (e.g., "研发部/软件组") instead of just the leaf department name in all employee list pages.

**Architecture:** Add a `getDepartmentPathMap()` utility that queries all departments and builds a `Map<departmentId, fullPath>` by walking parent chains. Each page.tsx calls this utility and replaces simple department names with full paths before passing data to client components. No client-side changes needed.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Prisma

---

## File Map

- Modify: `src/lib/department-tree.ts` — add `getDepartmentPathMap()` utility
- Modify: `src/app/(main)/overtime/page.tsx` — use path map to replace department names
- Modify: `src/app/(main)/leave/page.tsx` — use path map to replace department names
- Modify: `src/app/(main)/statistics/page.tsx` — use path map to replace department names
- Modify: `src/app/(main)/organization/page.tsx` — use path map to replace department names

---

### Task 1: Add getDepartmentPathMap utility

**Files:**
- Modify: `src/lib/department-tree.ts:1-2`

- [ ] **Step 1: Add getDepartmentPathMap function**

Append the following function at the end of `src/lib/department-tree.ts` (after line 83):

```tsx
export async function getDepartmentPathMap(): Promise<Map<string, string>> {
  const departments = await prisma.department.findMany({
    select: { id: true, name: true, parentId: true },
  });

  const deptMap = new Map(departments.map((d) => [d.id, d]));
  const pathMap = new Map<string, string>();

  for (const dept of departments) {
    const parts: string[] = [];
    let current: (typeof departments)[number] | undefined = dept;
    while (current) {
      parts.unshift(current.name);
      current = current.parentId ? deptMap.get(current.parentId) : undefined;
    }
    pathMap.set(dept.id, parts.join("/"));
  }

  return pathMap;
}
```

- [ ] **Step 2: Verify build compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/department-tree.ts
git commit -m "feat: add getDepartmentPathMap utility for full department paths"
```

---

### Task 2: Update overtime and leave pages to show full department path

**Files:**
- Modify: `src/app/(main)/overtime/page.tsx:3,52-63`
- Modify: `src/app/(main)/leave/page.tsx:3,52-63`

- [ ] **Step 1: Update overtime/page.tsx**

Add `getDepartmentPathMap` to the import on line 3:

```tsx
import { getAccessibleDepartmentTree, getDepartmentPathMap } from "@/lib/department-tree";
```

Change the records query (lines 52-63) to also select `departmentId` on user, then replace department names with full paths:

```tsx
  const pathMap = await getDepartmentPathMap();

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

  for (const r of records) {
    if (r.user.department && r.user.departmentId) {
      r.user.department.name = pathMap.get(r.user.departmentId) ?? r.user.department.name;
    }
  }
```

- [ ] **Step 2: Update leave/page.tsx**

Add `getDepartmentPathMap` to the import on line 3:

```tsx
import { getAccessibleDepartmentTree, getDepartmentPathMap } from "@/lib/department-tree";
```

Change the records query (lines 52-63) to also select `departmentId` on user, then replace department names with full paths:

```tsx
  const pathMap = await getDepartmentPathMap();

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

  for (const r of records) {
    if (r.user.department && r.user.departmentId) {
      r.user.department.name = pathMap.get(r.user.departmentId) ?? r.user.department.name;
    }
  }
```

- [ ] **Step 3: Verify build compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(main\)/overtime/page.tsx src/app/\(main\)/leave/page.tsx
git commit -m "feat: show full department path in overtime and leave records"
```

---

### Task 3: Update statistics and organization pages to show full department path

**Files:**
- Modify: `src/app/(main)/statistics/page.tsx:3,83`
- Modify: `src/app/(main)/organization/page.tsx:3,15-20`

- [ ] **Step 1: Update statistics/page.tsx**

Add `getDepartmentPathMap` to the import on line 3:

```tsx
import { getAccessibleDepartmentTree, getDepartmentPathMap } from "@/lib/department-tree";
```

Add `pathMap` call before the users query. Insert right before line 42 (`const users = ...`):

```tsx
  const pathMap = await getDepartmentPathMap();
```

Change line 83 in the stats mapping from:

```tsx
      department: u.department?.name ?? "-",
```

to:

```tsx
      department: (u.departmentId ? pathMap.get(u.departmentId) : null) ?? u.department?.name ?? "-",
```

- [ ] **Step 2: Update organization/page.tsx**

Add `getDepartmentPathMap` to the import on line 3:

```tsx
import { getDepartmentTree, getDepartmentPathMap } from "@/lib/department-tree";
```

Add `pathMap` call and post-processing after the users query. Replace lines 15-20:

```tsx
  const users = await prisma.user.findMany({
    include: {
      department: { select: { name: true } },
    },
    orderBy: { name: "asc" },
  });

  const pathMap = await getDepartmentPathMap();
  for (const u of users) {
    if (u.department && u.departmentId) {
      u.department.name = pathMap.get(u.departmentId) ?? u.department.name;
    }
  }
```

- [ ] **Step 3: Verify full project compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(main\)/statistics/page.tsx src/app/\(main\)/organization/page.tsx
git commit -m "feat: show full department path in statistics and organization pages"
```
