"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  createWorkYear,
  updateWorkYear,
  setCurrentWorkYear,
  deleteWorkYear,
} from "./actions";

type WorkYear = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
};

export function WorkYearClient({ workYears }: { workYears: WorkYear[] }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  function openCreate() {
    setEditingId(null);
    setDialogOpen(true);
  }

  function openEdit(id: string) {
    setEditingId(id);
    setDialogOpen(true);
  }

  const editing = editingId
    ? workYears.find((w) => w.id === editingId)
    : null;

  async function handleSubmit(formData: FormData) {
    if (editingId) {
      await updateWorkYear(editingId, formData);
    } else {
      await createWorkYear(formData);
    }
    setDialogOpen(false);
  }

  async function handleSetCurrent(id: string) {
    await setCurrentWorkYear(id);
  }

  async function handleDelete(id: string) {
    if (!confirm("确定要删除此工作年度吗？")) return;
    try {
      await deleteWorkYear(id);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">工作年度管理</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger
            render={
              <Button onClick={openCreate}>新建年度</Button>
            }
          />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? "编辑年度" : "新建年度"}</DialogTitle>
            </DialogHeader>
            <form action={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">名称</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={editing?.name ?? ""}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="startDate">开始日期</Label>
                <Input
                  id="startDate"
                  name="startDate"
                  type="date"
                  defaultValue={editing?.startDate?.slice(0, 10) ?? ""}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">结束日期</Label>
                <Input
                  id="endDate"
                  name="endDate"
                  type="date"
                  defaultValue={editing?.endDate?.slice(0, 10) ?? ""}
                  required
                />
              </div>
              <Button type="submit" className="w-full">
                保存
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {workYears.map((wy) => (
          <Card key={wy.id}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                {wy.name}
                {wy.isCurrent && <Badge>当前</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                {wy.startDate.slice(0, 10)} ~ {wy.endDate.slice(0, 10)}
              </p>
              <div className="flex gap-2">
                {!wy.isCurrent && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSetCurrent(wy.id)}
                  >
                    设为当前
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openEdit(wy.id)}
                >
                  编辑
                </Button>
                {!wy.isCurrent && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(wy.id)}
                  >
                    删除
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
