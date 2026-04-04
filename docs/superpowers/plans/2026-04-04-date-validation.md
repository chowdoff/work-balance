# 加班/请假记录日期范围验证 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent overtime and leave records from having dates outside the work year's start/end range, with both frontend and backend validation.

**Architecture:** Frontend uses HTML `min`/`max` attributes on date inputs to restrict selectable range. Backend Server Actions query the WorkYear and validate the date before creating/updating records.

**Tech Stack:** Next.js Server Actions, Prisma, HTML5 date input attributes

---

### Task 1: Backend validation for overtime actions

**Files:**
- Modify: `src/app/(main)/overtime/actions.ts`

- [ ] **Step 1: Add date validation to `createOvertime`**

In `src/app/(main)/overtime/actions.ts`, add a WorkYear lookup and date range check after the permission check and before the `prisma.overtimeRecord.create` call:

```typescript
// Add after the accessible check (line 20-22), before the create call (line 24)
const workYear = await prisma.workYear.findUnique({ where: { id: workYearId } });
if (!workYear) throw new Error("工作年度不存在");

const dateObj = new Date(date);
if (dateObj < workYear.startDate || dateObj > workYear.endDate) {
  const start = workYear.startDate.toISOString().slice(0, 10);
  const end = workYear.endDate.toISOString().slice(0, 10);
  throw new Error(`日期必须在工作年度范围内（${start} ~ ${end}）`);
}
```

- [ ] **Step 2: Add date validation to `updateOvertime`**

In the same file, add a similar check in `updateOvertime` after the permission check and before `prisma.overtimeRecord.update`. Since `updateOvertime` doesn't receive `workYearId` from the form (it uses the existing record's `workYearId`), use `record.workYearId`:

```typescript
// Add after the accessible check (line 42-44), before the update call (line 50)
const workYear = await prisma.workYear.findUnique({ where: { id: record.workYearId } });
if (!workYear) throw new Error("工作年度不存在");

const dateObj = new Date(date);
if (dateObj < workYear.startDate || dateObj > workYear.endDate) {
  const start = workYear.startDate.toISOString().slice(0, 10);
  const end = workYear.endDate.toISOString().slice(0, 10);
  throw new Error(`日期必须在工作年度范围内（${start} ~ ${end}）`);
}
```

- [ ] **Step 3: Verify the app builds**

Run: `npx next build 2>&1 | tail -20`
Expected: Build succeeds without errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/(main)/overtime/actions.ts
git commit -m "feat: add date range validation to overtime server actions"
```

---

### Task 2: Backend validation for leave actions

**Files:**
- Modify: `src/app/(main)/leave/actions.ts`

- [ ] **Step 1: Add date validation to `createLeave`**

In `src/app/(main)/leave/actions.ts`, add a WorkYear lookup and date range check after the permission check (line 20-22) and before the balance check (line 26):

```typescript
// Add after the accessible check, before the balance check
const workYear = await prisma.workYear.findUnique({ where: { id: workYearId } });
if (!workYear) throw new Error("工作年度不存在");

const dateObj = new Date(date);
if (dateObj < workYear.startDate || dateObj > workYear.endDate) {
  const start = workYear.startDate.toISOString().slice(0, 10);
  const end = workYear.endDate.toISOString().slice(0, 10);
  throw new Error(`日期必须在工作年度范围内（${start} ~ ${end}）`);
}
```

- [ ] **Step 2: Add date validation to `updateLeave`**

In the same file, add a similar check in `updateLeave` after the permission check and before the balance check. Use `record.workYearId`:

```typescript
// Add after the accessible check (line 57-59), before the balance lookup (line 62)
const workYear = await prisma.workYear.findUnique({ where: { id: record.workYearId } });
if (!workYear) throw new Error("工作年度不存在");

const dateObj = new Date(date);
if (dateObj < workYear.startDate || dateObj > workYear.endDate) {
  const start = workYear.startDate.toISOString().slice(0, 10);
  const end = workYear.endDate.toISOString().slice(0, 10);
  throw new Error(`日期必须在工作年度范围内（${start} ~ ${end}）`);
}
```

- [ ] **Step 3: Verify the app builds**

Run: `npx next build 2>&1 | tail -20`
Expected: Build succeeds without errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/(main)/leave/actions.ts
git commit -m "feat: add date range validation to leave server actions"
```

---

### Task 3: Frontend date restriction for overtime

**Files:**
- Modify: `src/app/(main)/overtime/page.tsx`
- Modify: `src/app/(main)/overtime/client.tsx`

- [ ] **Step 1: Pass date range from page to client**

In `src/app/(main)/overtime/page.tsx`, format the work year dates and pass them as props. Change the `<OvertimeClient>` JSX to include two new props:

```tsx
// In the return statement, add two new props to OvertimeClient:
<OvertimeClient
  records={JSON.parse(JSON.stringify(records))}
  role={role}
  currentWorkYearId={currentWorkYear.id}
  currentWorkYearName={currentWorkYear.name}
  manageableUsers={manageableUsers}
  workYearStartDate={currentWorkYear.startDate.toISOString().slice(0, 10)}
  workYearEndDate={currentWorkYear.endDate.toISOString().slice(0, 10)}
/>
```

- [ ] **Step 2: Update client component Props and date input**

In `src/app/(main)/overtime/client.tsx`:

1. Add the new fields to the `Props` type:

```typescript
type Props = {
  records: OvertimeData[];
  role: UserRole;
  currentWorkYearId: string;
  currentWorkYearName: string;
  manageableUsers: { id: string; name: string }[];
  workYearStartDate: string;
  workYearEndDate: string;
};
```

2. Destructure the new props in the component function signature:

```typescript
export function OvertimeClient({
  records,
  role,
  currentWorkYearId,
  currentWorkYearName,
  manageableUsers,
  workYearStartDate,
  workYearEndDate,
}: Props) {
```

3. Add `min` and `max` to the date `<Input>` (currently around line 128-133):

```tsx
<Input
  id="date"
  name="date"
  type="date"
  defaultValue={editing?.date?.slice(0, 10) ?? ""}
  min={workYearStartDate}
  max={workYearEndDate}
  required
/>
```

- [ ] **Step 3: Verify the app builds**

Run: `npx next build 2>&1 | tail -20`
Expected: Build succeeds without errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/(main)/overtime/page.tsx src/app/(main)/overtime/client.tsx
git commit -m "feat: restrict overtime date input to work year range"
```

---

### Task 4: Frontend date restriction for leave

**Files:**
- Modify: `src/app/(main)/leave/page.tsx`
- Modify: `src/app/(main)/leave/client.tsx`

- [ ] **Step 1: Pass date range from page to client**

In `src/app/(main)/leave/page.tsx`, add the same two props to `<LeaveClient>`:

```tsx
<LeaveClient
  records={JSON.parse(JSON.stringify(records))}
  role={role}
  currentWorkYearId={currentWorkYear.id}
  currentWorkYearName={currentWorkYear.name}
  manageableUsers={manageableUsers}
  workYearStartDate={currentWorkYear.startDate.toISOString().slice(0, 10)}
  workYearEndDate={currentWorkYear.endDate.toISOString().slice(0, 10)}
/>
```

- [ ] **Step 2: Update client component Props and date input**

In `src/app/(main)/leave/client.tsx`:

1. Add the new fields to the `Props` type:

```typescript
type Props = {
  records: LeaveData[];
  role: UserRole;
  currentWorkYearId: string;
  currentWorkYearName: string;
  manageableUsers: { id: string; name: string }[];
  workYearStartDate: string;
  workYearEndDate: string;
};
```

2. Destructure the new props in the component function signature:

```typescript
export function LeaveClient({
  records,
  role,
  currentWorkYearId,
  currentWorkYearName,
  manageableUsers,
  workYearStartDate,
  workYearEndDate,
}: Props) {
```

3. Add `min` and `max` to the date `<Input>` (currently around line 150-156):

```tsx
<Input
  id="date"
  name="date"
  type="date"
  defaultValue={editing?.date?.slice(0, 10) ?? ""}
  min={workYearStartDate}
  max={workYearEndDate}
  required
/>
```

- [ ] **Step 3: Verify the app builds**

Run: `npx next build 2>&1 | tail -20`
Expected: Build succeeds without errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/(main)/leave/page.tsx src/app/(main)/leave/client.tsx
git commit -m "feat: restrict leave date input to work year range"
```
