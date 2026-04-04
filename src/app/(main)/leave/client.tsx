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
  startDate: string;
  endDate: string;
};

type Props = {
  records: LeaveData[];
  role: UserRole;
  selectedWorkYearId: string;
  manageableUsers: { id: string; name: string }[];
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

  function openCreate() {
    setEditingId(null);
    setFormWorkYearId(selectedWorkYearId);
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
