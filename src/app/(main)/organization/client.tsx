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
import { DepartmentTreeSelect } from "@/components/department-tree-select";
import type { DepartmentNode } from "@/lib/department-tree";
import {
  createDepartment,
  updateDepartment,
  deleteDepartment,
  createUser,
  updateUser,
  deleteUser,
} from "./actions";

type UserData = {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  departmentId: string | null;
  department: { name: string } | null;
};

function flattenTree(nodes: DepartmentNode[], depth = 0): { node: DepartmentNode; depth: number }[] {
  return nodes.flatMap((node) => [
    { node, depth },
    ...flattenTree(node.children, depth + 1),
  ]);
}

export function OrganizationClient({
  tree,
  users,
  annualLeaveMap,
}: {
  tree: DepartmentNode[];
  users: UserData[];
  annualLeaveMap: Record<string, number>;
}) {
  // Department dialog state
  const [deptDialogOpen, setDeptDialogOpen] = useState(false);
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null);

  // User dialog state
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  // Selected department for filtering users
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);

  const flatDepts = flattenTree(tree);

  function openCreateDept() {
    setEditingDeptId(null);
    setDeptDialogOpen(true);
  }

  function openEditDept(id: string) {
    setEditingDeptId(id);
    setDeptDialogOpen(true);
  }

  function openCreateUser() {
    setEditingUserId(null);
    setUserDialogOpen(true);
  }

  function openEditUser(id: string) {
    setEditingUserId(id);
    setUserDialogOpen(true);
  }

  const editingDept = editingDeptId
    ? flatDepts.find((d) => d.node.id === editingDeptId)?.node ?? null
    : null;

  const editingUser = editingUserId
    ? users.find((u) => u.id === editingUserId) ?? null
    : null;

  async function handleDeptSubmit(formData: FormData) {
    if (editingDeptId) {
      await updateDepartment(editingDeptId, formData);
    } else {
      await createDepartment(formData);
    }
    setEditingDeptId(null);
    setDeptDialogOpen(false);
  }

  async function handleDeleteDept(id: string) {
    if (!confirm("确定要删除此部门吗？")) return;
    try {
      await deleteDepartment(id);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleUserSubmit(formData: FormData) {
    if (editingUserId) {
      await updateUser(editingUserId, formData);
    } else {
      await createUser(formData);
    }
    setEditingUserId(null);
    setUserDialogOpen(false);
  }

  async function handleDeleteUser(id: string) {
    if (!confirm("确定要删除此员工吗？")) return;
    try {
      await deleteUser(id);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
    }
  }

  const filteredUsers = selectedDeptId
    ? users.filter((u) => u.departmentId === selectedDeptId)
    : users;

  return (
    <div className="flex gap-6 h-full">
      {/* Left column: department tree */}
      <div className="w-64 shrink-0 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">部门管理</h2>
          <Dialog open={deptDialogOpen} onOpenChange={setDeptDialogOpen}>
            <DialogTrigger
              render={
                <Button size="sm" onClick={openCreateDept}>
                  新增
                </Button>
              }
            />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingDeptId ? "编辑部门" : "新建部门"}
                </DialogTitle>
              </DialogHeader>
              <form key={editingDeptId ?? "new"} action={handleDeptSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="dept-name">部门名称</Label>
                  <Input
                    id="dept-name"
                    name="name"
                    defaultValue={editingDept?.name ?? ""}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dept-parentId">上级部门</Label>
                  <DepartmentTreeSelect
                    key={editingDept?.id ?? "new"}
                    tree={tree}
                    name="parentId"
                    allowEmpty
                    value={editingDept?.parentId ?? ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dept-managerId">部门负责人</Label>
                  <select
                    name="managerId"
                    defaultValue={editingDept?.managerId ?? ""}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  >
                    <option value="">无</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>
                <Button type="submit" className="w-full">
                  保存
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="border rounded-md overflow-hidden">
          <button
            className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors ${selectedDeptId === null ? "bg-muted font-medium" : ""}`}
            onClick={() => setSelectedDeptId(null)}
          >
            全部员工
          </button>
          {flatDepts.map(({ node, depth }) => (
            <div
              key={node.id}
              className={`flex items-center justify-between px-3 py-2 text-sm hover:bg-muted transition-colors border-t ${selectedDeptId === node.id ? "bg-muted" : ""}`}
            >
              <button
                className="flex-1 text-left truncate"
                onClick={() => setSelectedDeptId(node.id)}
                style={{ paddingLeft: depth * 12 }}
              >
                {node.name}
                {node.managerName && (
                  <span className="text-muted-foreground ml-1">
                    ({node.managerName})
                  </span>
                )}
              </button>
              <div className="flex gap-1 shrink-0 ml-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => openEditDept(node.id)}
                >
                  编辑
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                  onClick={() => handleDeleteDept(node.id)}
                >
                  删除
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right column: employee table */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">
            {selectedDeptId
              ? flatDepts.find((d) => d.node.id === selectedDeptId)?.node.name ?? "员工管理"
              : "员工管理"}
          </h1>
          <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
            <DialogTrigger
              render={
                <Button onClick={openCreateUser}>新增员工</Button>
              }
            />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingUserId ? "编辑员工" : "新增员工"}
                </DialogTitle>
              </DialogHeader>
              <form key={editingUserId ?? "new-user"} action={handleUserSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="user-name">姓名</Label>
                  <Input
                    id="user-name"
                    name="name"
                    defaultValue={editingUser?.name ?? ""}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="user-email">邮箱</Label>
                  <Input
                    id="user-email"
                    name="email"
                    type="email"
                    defaultValue={editingUser?.email ?? ""}
                    required
                  />
                </div>
                {!editingUserId && (
                  <div className="space-y-2">
                    <Label htmlFor="user-password">密码</Label>
                    <Input
                      id="user-password"
                      name="password"
                      type="password"
                      required
                    />
                  </div>
                )}
                {editingUserId && (
                  <div className="space-y-2">
                    <Label htmlFor="user-newPassword">新密码（留空不修改）</Label>
                    <Input
                      id="user-newPassword"
                      name="newPassword"
                      type="password"
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="user-departmentId">所属部门</Label>
                  <DepartmentTreeSelect
                    key={editingUser?.id ?? "new-user"}
                    tree={tree}
                    name="departmentId"
                    allowEmpty
                    value={editingUser?.departmentId ?? ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="user-annualLeave">年假天数（当前年度）</Label>
                  <Input
                    id="user-annualLeave"
                    name="annualLeave"
                    type="number"
                    step="0.5"
                    min="0"
                    defaultValue={
                      editingUserId
                        ? (annualLeaveMap[editingUserId] ?? 0)
                        : 0
                    }
                  />
                </div>
                <Button type="submit" className="w-full">
                  保存
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="border rounded-md overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>姓名</TableHead>
                <TableHead>邮箱</TableHead>
                <TableHead>部门</TableHead>
                <TableHead className="text-right">年假天数</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    暂无员工
                  </TableCell>
                </TableRow>
              )}
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    {user.name}
                    {user.isAdmin && (
                      <span className="ml-2 text-xs bg-primary/10 text-primary rounded px-1">
                        管理员
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {user.email}
                  </TableCell>
                  <TableCell>
                    {user.department?.name ?? (
                      <span className="text-muted-foreground">未分配</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {annualLeaveMap[user.id] ?? 0}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditUser(user.id)}
                      >
                        编辑
                      </Button>
                      {!user.isAdmin && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteUser(user.id)}
                        >
                          删除
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
