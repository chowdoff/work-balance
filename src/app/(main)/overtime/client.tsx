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
