"use client";

import { useState } from "react";
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
  user: { name: string };
};

type Props = {
  records: LeaveData[];
  role: UserRole;
  currentWorkYearId: string;
  currentWorkYearName: string;
  manageableUsers: { id: string; name: string }[];
};

const LEAVE_TYPE_LABELS: Record<string, string> = {
  COMPENSATORY: "调休",
  ANNUAL: "年假",
};

export function LeaveClient({
  records,
  role,
  currentWorkYearId,
  currentWorkYearName,
  manageableUsers,
}: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const canManage = role !== "employee";

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
        <div>
          <h1 className="text-2xl font-bold">请假记录</h1>
          <p className="text-sm text-muted-foreground mt-1">{currentWorkYearName}</p>
        </div>
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
              <form action={handleSubmit} className="space-y-4">
                <input type="hidden" name="workYearId" value={currentWorkYearId} />
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

      <div className="border rounded-md overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>员工</TableHead>
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
                  colSpan={canManage ? 6 : 5}
                  className="text-center text-muted-foreground py-8"
                >
                  暂无请假记录
                </TableCell>
              </TableRow>
            )}
            {records.map((record) => (
              <TableRow key={record.id}>
                <TableCell className="font-medium">{record.user.name}</TableCell>
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
