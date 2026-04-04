# 部门筛选器权限过滤 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Filter department tree selectors based on the current user's role — admins see all departments, managers see only their managed departments and sub-departments.

**Architecture:** Add a `getAccessibleDepartmentTree` function in `src/lib/department-tree.ts` that wraps `getDepartmentTree` with role-based filtering. Consumers call this function instead of `getDepartmentTree` to get a permission-filtered tree. A helper `filterTree` prunes the full tree to only include nodes whose IDs are in the accessible set (and their ancestors as path nodes).

**Tech Stack:** Next.js Server Components, Prisma, TypeScript

---

### Task 1: Add `getAccessibleDepartmentTree` function

**Files:**
- Modify: `src/lib/department-tree.ts`

- [ ] **Step 1: Add the import for `UserRole` and `getManagedDepartmentIds`**

At the top of `src/lib/department-tree.ts`, add:

```typescript
import type { UserRole } from "@/lib/auth-utils";
import { getManagedDepartmentIds } from "@/lib/auth-utils";
```

Note: `getManagedDepartmentIds` is currently imported dynamically inside `auth-utils.ts` to avoid circular dependencies. Since `department-tree.ts` imports from `auth-utils.ts`, we need to check for circular imports. Actually, `auth-utils.ts` dynamically imports `department-tree.ts` inside `getManagedDepartmentIds` (line 39: `const { getSubDepartmentIds } = await import("@/lib/department-tree")`), so a static import from `department-tree.ts` → `auth-utils.ts` would create a circular dependency.

**Instead**, use a dynamic import inside the function to avoid the circular dependency:

```typescript
// No new imports at the top of the file — use dynamic import inside the function
```

- [ ] **Step 2: Add the `filterTree` helper and `getAccessibleDepartmentTree` function**

Add at the bottom of `src/lib/department-tree.ts`, after the existing `getDepartmentTree` function:

```typescript
function filterTree(
  nodes: DepartmentNode[],
  accessibleIds: Set<string>
): DepartmentNode[] {
  const result: DepartmentNode[] = [];
  for (const node of nodes) {
    if (accessibleIds.has(node.id)) {
      // Node is accessible — keep it with all its children intact
      result.push(node);
    } else {
      // Node is not accessible — check if any descendant is
      const filteredChildren = filterTree(node.children, accessibleIds);
      if (filteredChildren.length > 0) {
        // Keep this node as a path node with only accessible branches
        result.push({ ...node, children: filteredChildren });
      }
    }
  }
  return result;
}

export async function getAccessibleDepartmentTree(
  userId: string,
  role: string
): Promise<DepartmentNode[]> {
  const tree = await getDepartmentTree();
  if (role === "admin") return tree;

  const { getManagedDepartmentIds } = await import("@/lib/auth-utils");
  const accessibleIds = new Set(await getManagedDepartmentIds(userId));
  return filterTree(tree, accessibleIds);
}
```

Key design decisions:
- `role` parameter is typed as `string` (not `UserRole`) to avoid importing the type and the circular dependency
- `filterTree` is a pure function (not exported) that recursively prunes the tree
- When a node is in the accessible set, its entire subtree is kept (because `getManagedDepartmentIds` already includes all sub-department IDs)
- When a node is NOT in the set but has accessible descendants, it's kept as a structural path node with only accessible branches in `children`
- Dynamic import of `getManagedDepartmentIds` avoids circular dependency with `auth-utils.ts`

- [ ] **Step 3: Verify the app builds**

Run: `npx next build 2>&1 | tail -20`
Expected: Build succeeds without errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/department-tree.ts
git commit -m "feat: add getAccessibleDepartmentTree for role-based department filtering"
```

---

### Task 2: Use `getAccessibleDepartmentTree` in statistics page

**Files:**
- Modify: `src/app/(main)/statistics/page.tsx`

- [ ] **Step 1: Replace `getDepartmentTree` with `getAccessibleDepartmentTree`**

In `src/app/(main)/statistics/page.tsx`:

1. Change the import on line 3. Current:

```typescript
import { getDepartmentTree } from "@/lib/department-tree";
```

Change to:

```typescript
import { getAccessibleDepartmentTree } from "@/lib/department-tree";
```

2. Change the tree fetch on line 18. Current:

```typescript
const tree = await getDepartmentTree();
```

Change to:

```typescript
const tree = await getAccessibleDepartmentTree(user.id, role);
```

- [ ] **Step 2: Verify the app builds**

Run: `npx next build 2>&1 | tail -20`
Expected: Build succeeds without errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/(main)/statistics/page.tsx
git commit -m "feat: filter department tree by user role in statistics page"
```
