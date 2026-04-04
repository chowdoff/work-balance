# 加班/请假记录页面增加部门列和筛选器

## 概述

加班记录和请假记录页面增加：
1. 表格中新增"部门"列
2. 部门筛选器（按权限过滤可见部门）
3. 年度筛选器（可切换工作年度）

筛选器使用 URL searchParams 驱动，与统计页面保持一致。

## 设计

加班和请假两个模块改动完全对称。

### page.tsx 改动（overtime/page.tsx、leave/page.tsx）

- 函数签名接收 `searchParams: Promise<{ departmentId?: string; workYearId?: string }>`
- 查询所有工作年度列表 `prisma.workYear.findMany({ orderBy: { startDate: "desc" } })`
- 默认选中 `isCurrent` 的年度，如有 `workYearId` 参数则使用该参数
- 调用 `getAccessibleDepartmentTree(user.id, role)` 获取权限过滤后的部门树
- 构建 `userWhere` 条件：有 `departmentId` 参数时按部门过滤，经理无参数时限制为可管理的部门
- 记录查询的 `include` 中加入 `user: { select: { name: true, department: { select: { name: true } } } }`
- 将 `tree`、`workYears`（JSON 序列化）、`selectedDepartmentId`、`selectedWorkYearId` 传给客户端
- 日期验证用的 `workYearStartDate`/`workYearEndDate` 从选中的年度对象获取

### client.tsx 改动（overtime/client.tsx、leave/client.tsx）

**Props 变化：**
- 新增：`tree: DepartmentNode[]`、`workYears: WorkYear[]`、`selectedDepartmentId: string`、`selectedWorkYearId: string`
- 移除：`currentWorkYearName`（由年度选择器替代）
- `currentWorkYearId` 改名为 `selectedWorkYearId`（语义更准确）

**数据类型变化：**
- `OvertimeData` / `LeaveData` 的 `user` 字段从 `{ name: string }` 改为 `{ name: string; department: { name: string } | null }`

**WorkYear 类型（在 client 文件中定义）：**
```typescript
type WorkYear = {
  id: string;
  name: string;
  isCurrent: boolean;
};
```

**UI 变化：**
- 标题下方增加筛选器区域（与统计页面相同布局）
  - 部门筛选器：`DepartmentTreeSelect`，`allowEmpty` 显示"全部部门"
  - 年度筛选器：`<select>` 渲染年度列表，当前年度标记 `(当前)`
- 选择变化时 `router.push` 更新 URL（复用统计页面的 `updateFilter` 模式）
- 表格新增"部门"列（"员工"列之后），显示 `record.user.department?.name ?? "-"`
- `employee` 角色不显示筛选器（无意义）

### 权限处理

- `employee`：无筛选器，只看自己的记录（行为不变）
- `manager`：部门筛选器只显示管理的部门及子部门（使用 `getAccessibleDepartmentTree`）
- `admin`：部门筛选器显示全部部门

后端查询也按角色限制：经理无 departmentId 参数时默认限制为可管理部门的用户，有 departmentId 参数时验证该部门是否在可管理范围内。

### 不涉及的内容

- 统计页面 — 已有筛选器，不改动
- 组织管理页面 — 仅 admin 可访问，不改动
- `DepartmentTreeSelect` 组件 — 纯展示，不改动
