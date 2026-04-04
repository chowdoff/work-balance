# 部门筛选器权限过滤

## 概述

所有使用部门树选择器的页面，应根据当前登录用户的角色过滤可见部门。管理员看到全部部门，经理只看到其管理的部门及子部门。

## 设计

### 新增函数：`getAccessibleDepartmentTree`

**文件：** `src/lib/department-tree.ts`

新增 `getAccessibleDepartmentTree(userId: string, role: UserRole)` 函数：

- **admin** → 直接返回 `getDepartmentTree()` 全量树
- **manager** → 调用 `getManagedDepartmentIds(userId)` 获取可访问部门 ID 集合，然后从全量树中裁剪

**裁剪逻辑：** 递归遍历树节点。如果节点 ID 在可访问集合中，保留该节点及其全部子节点（因为 `getManagedDepartmentIds` 已包含子部门 ID，命中即保留整棵子树）。如果不在集合中，递归检查其子节点是否有可访问的，有则保留该节点作为路径上的中间节点（children 只包含可访问的分支），无则丢弃。

### 消费方改动

**文件：** `src/app/(main)/statistics/page.tsx`

将 `const tree = await getDepartmentTree()` 替换为 `const tree = await getAccessibleDepartmentTree(user.id, role)`。

### 不涉及的内容

- `DepartmentTreeSelect` 组件 — 纯展示组件，不改动
- `organization/` 页面 — 仅 admin 可访问（已有 `if (role !== "admin") redirect` 守卫），全量树合理，不改动
- `employee` 角色不会看到部门筛选器（统计页面已对 employee 做了 redirect）
