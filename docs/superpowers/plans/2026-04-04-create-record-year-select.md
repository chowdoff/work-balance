# 新增记录时选择年度 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to select a work year when creating overtime/leave records, with date input ranges dynamically linked to the selected year.

**Architecture:** Enrich the `workYears` array passed from server to client with `startDate`/`endDate` strings, replacing the separate `workYearStartDate`/`workYearEndDate` props. Client components gain a `formWorkYearId` state that drives a year `<select>` in create mode and dynamically constrains the date input's `min`/`max`.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Prisma

---

## File Map

- Modify: `src/app/(main)/overtime/page.tsx` — enrich workYears, remove separate date props
- Modify: `src/app/(main)/overtime/client.tsx` — add formWorkYearId state, year select in form, dynamic date range
- Modify: `src/app/(main)/leave/page.tsx` — same changes as overtime/page.tsx
- Modify: `src/app/(main)/leave/client.tsx` — same changes as overtime/client.tsx

---

### Task 1: Overtime page.tsx — enrich workYears, remove date props

**Files:**
- Modify: `src/app/(main)/overtime/page.tsx:15,77-89`

- [ ] **Step 1: Update workYears serialization to include startDate/endDate**

In `page.tsx`, change the workYears passed to client. Replace lines 77-89:

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

Also remove the now-unused `selectedWorkYear` lookup (line 23):

```diff
- const selectedWorkYear = workYears.find((w) => w.id === selectedWorkYearId)!;
```

- [ ] **Step 2: Verify build compiles (will fail until client.tsx is updated)**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: Type errors in `overtime/client.tsx` about missing `workYearStartDate`/`workYearEndDate` props — this is correct, we fix it in Task 2.

---

### Task 2: Overtime client.tsx — year select in form, dynamic date range

**Files:**
- Modify: `src/app/(main)/overtime/client.tsx:38-54,56-66,85-88,135-136,155-165`

- [ ] **Step 1: Update WorkYear type and Props**

Replace the `WorkYear` type (lines 38-42) with:

```tsx
type WorkYear = {
  id: string;
  name: string;
  isCurrent: boolean;
  startDate: string;
  endDate: string;
};
```

Replace the `Props` type (lines 44-54) with:

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

- [ ] **Step 2: Update component signature and add formWorkYearId state**

Replace the component destructuring (lines 56-66) with:

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
```

Add `formWorkYearId` state right after the existing `useState` lines (after line 69):

```tsx
  const [formWorkYearId, setFormWorkYearId] = useState(selectedWorkYearId);
```

- [ ] **Step 3: Reset formWorkYearId in openCreate**

Replace `openCreate` function (lines 85-88) with:

```tsx
  function openCreate() {
    setEditingId(null);
    setFormWorkYearId(selectedWorkYearId);
    setDialogOpen(true);
  }
```

- [ ] **Step 4: Replace hidden workYearId input with conditional year select**

Replace the hidden input and the `{!editingId && (` block in the form. Replace from line 136 (`<input type="hidden"...`) through line 154 (closing of employee select `</div>`):

```tsx
                {!editingId ? (
                  <>
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
                  </>
                ) : (
                  <input type="hidden" name="workYearId" value={editing!.workYearId} />
                )}
```

- [ ] **Step 5: Update date input min/max to use dynamic lookup**

Replace the date `<Input>` block (lines 155-165) with:

```tsx
                <div className="space-y-2">
                  <Label htmlFor="date">日期</Label>
                  <Input
                    id="date"
                    name="date"
                    type="date"
                    defaultValue={editing?.date?.slice(0, 10) ?? ""}
                    min={workYears.find((w) => w.id === (editingId ? editing!.workYearId : formWorkYearId))?.startDate}
                    max={workYears.find((w) => w.id === (editingId ? editing!.workYearId : formWorkYearId))?.endDate}
                    required
                  />
                </div>
```

- [ ] **Step 6: Verify overtime module compiles**

Run: `npx tsc --noEmit 2>&1 | grep "overtime"`
Expected: No errors for overtime files.

- [ ] **Step 7: Commit overtime changes**

```bash
git add src/app/\(main\)/overtime/page.tsx src/app/\(main\)/overtime/client.tsx
git commit -m "feat: add work year select to overtime create dialog"
```

---

### Task 3: Leave page.tsx — enrich workYears, remove date props

**Files:**
- Modify: `src/app/(main)/leave/page.tsx:23,77-89`

- [ ] **Step 1: Update workYears serialization to include startDate/endDate**

In `page.tsx`, replace lines 77-89:

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

Also remove the now-unused `selectedWorkYear` lookup (line 23):

```diff
- const selectedWorkYear = workYears.find((w) => w.id === selectedWorkYearId)!;
```

---

### Task 4: Leave client.tsx — year select in form, dynamic date range

**Files:**
- Modify: `src/app/(main)/leave/client.tsx:39-55,62-72,91-94,142,143-175,178-186`

- [ ] **Step 1: Update WorkYear type and Props**

Replace the `WorkYear` type (lines 39-43) with:

```tsx
type WorkYear = {
  id: string;
  name: string;
  isCurrent: boolean;
  startDate: string;
  endDate: string;
};
```

Replace the `Props` type (lines 45-55) with:

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

- [ ] **Step 2: Update component signature and add formWorkYearId state**

Replace the component destructuring (lines 62-72) with:

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
```

Add `formWorkYearId` state right after the existing `useState` lines (after line 75):

```tsx
  const [formWorkYearId, setFormWorkYearId] = useState(selectedWorkYearId);
```

- [ ] **Step 3: Reset formWorkYearId in openCreate**

Replace `openCreate` function (lines 91-94) with:

```tsx
  function openCreate() {
    setEditingId(null);
    setFormWorkYearId(selectedWorkYearId);
    setDialogOpen(true);
  }
```

- [ ] **Step 4: Replace hidden workYearId input with conditional year select**

Replace the hidden input (line 142) and the `{!editingId && (` block (lines 143-175) with:

```tsx
                {!editingId ? (
                  <>
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
                ) : (
                  <input type="hidden" name="workYearId" value={editing!.workYearId} />
                )}
```

- [ ] **Step 5: Update date input min/max to use dynamic lookup**

Replace the date `<Input>` block (lines 178-186) with:

```tsx
                <div className="space-y-2">
                  <Label htmlFor="date">日期</Label>
                  <Input
                    id="date"
                    name="date"
                    type="date"
                    defaultValue={editing?.date?.slice(0, 10) ?? ""}
                    min={workYears.find((w) => w.id === (editingId ? editing!.workYearId : formWorkYearId))?.startDate}
                    max={workYears.find((w) => w.id === (editingId ? editing!.workYearId : formWorkYearId))?.endDate}
                    required
                  />
                </div>
```

- [ ] **Step 6: Verify full project compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 7: Commit leave changes**

```bash
git add src/app/\(main\)/leave/page.tsx src/app/\(main\)/leave/client.tsx
git commit -m "feat: add work year select to leave create dialog"
```
