# 部门列显示完整路径

## 概述

页面中显示员工列表时，部门列显示完整的部门路径（如"研发部/软件组"），而非仅显示直属部门名称。

## 设计

### 新增工具函数

在 `src/lib/department-tree.ts` 中新增：

```ts
export async function getDepartmentPathMap(): Promise<Map<string, string>>
```

- 查询所有部门（id, name, parentId）
- 对每个部门，沿 parentId 链向上遍历，收集祖先名称
- 拼接为 `祖先/父级/当前` 格式的完整路径
- 返回 `Map<departmentId, fullPath>`

### page.tsx 改动

以下四个页面需要调用 `getDepartmentPathMap()`，将部门名替换为完整路径后传给客户端：

- `src/app/(main)/overtime/page.tsx` — 记录中的 `user.department.name`
- `src/app/(main)/leave/page.tsx` — 记录中的 `user.department.name`
- `src/app/(main)/statistics/page.tsx` — 用户的 `department.name`
- `src/app/(main)/organization/page.tsx` — 用户的 `department.name`

### 客户端不需要改动

客户端组件已有部门列，显示的是字符串。服务端传入完整路径后，客户端无需任何修改。

### 不涉及的内容

- 数据库 schema 不变
- 部门创建/编辑逻辑不变
- DepartmentTreeSelect 组件不变
