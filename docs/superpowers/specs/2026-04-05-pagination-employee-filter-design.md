# 分页与员工筛选器设计

## 概述

加班记录和请假记录页面当前一次性加载全部记录，无分页功能。同时管理员/经理页面缺少员工筛选器，只能按部门和工作年度筛选。本次增强为两个页面添加服务端分页（20 条/页）和员工筛选器（与部门筛选器单向联动）。

## 涉及页面

- `/overtime` — 加班记录
- `/leave` — 请假记录

两个页面结构对称，改动方式完全一致。

## URL 参数设计

在现有 `departmentId` 和 `workYearId` 基础上新增：

| 参数 | 用途 | 默认值 |
|---|---|---|
| `page` | 当前页码，从 1 开始 | 1 |
| `userId` | 筛选指定员工 | 空（全部员工） |

完整示例：`/overtime?departmentId=xx&workYearId=yy&userId=zz&page=2`

## 筛选器设计

### 布局

筛选器栏（仅管理员/经理可见）从左到右排列：**部门** → **员工** → **工作年度**

### 联动逻辑

- 切换**部门**时：清空 `userId`，重置 `page=1`，员工下拉列表更新为该部门成员
- 切换**员工**时：重置 `page=1`，保持当前部门和工作年度
- 切换**工作年度**时：保持 `departmentId` 和 `userId`，重置 `page=1`

### 员工筛选器选项

- 选了部门时：显示该部门员工
- 未选部门时：显示所有可管理员工
- 包含一个「全部员工」空选项

### 数据来源

`page.tsx` 中现有的 `manageableUsers` 查询结果同时传给筛选器和新增记录对话框，不需要额外查询。

## 分页设计

### 服务端查询

在现有 `findMany` 查询基础上增加 `skip` 和 `take`，新增 `count` 查询获取总数。两个查询通过 `Promise.all` 并行执行。

```
const pageSize = 20;
const page = Math.max(1, Number(params.page) || 1);
const skip = (page - 1) * pageSize;

const [records, totalCount] = await Promise.all([
  prisma.xxxRecord.findMany({ where, skip, take: pageSize, orderBy, include }),
  prisma.xxxRecord.count({ where }),
]);
const totalPages = Math.ceil(totalCount / pageSize);
```

如果 searchParams 中有 `userId`，在 where 条件中追加 `userId` 过滤。

传给 `client.tsx` 的新增 props：`page`、`totalPages`、`totalCount`。

### 分页 UI

位于表格底部：

- 左侧：「共 X 条记录」
- 右侧：上一页 / 页码按钮 / 下一页
- 页码按钮显示当前页附近页码（如 1 ... 4 5 **6** 7 8 ... 20），避免页码过多
- 点击翻页通过 `router.push` 更新 URL 中的 `page` 参数，保持其他筛选参数不变
- 第一页时「上一页」禁用，最后一页时「下一页」禁用
- 只有 1 页时不显示分页控件

### 员工角色

员工角色没有筛选器，但同样需要分页。他们的页面只显示自己的记录，分页逻辑一样。

## 权限设计

| 角色 | 筛选器 | 分页 |
|---|---|---|
| employee | 无筛选器 | 有，仅看自己的记录 |
| manager | 部门 + 员工 + 工作年度 | 有，范围为管理的部门 |
| admin | 部门 + 员工 + 工作年度 | 有，范围为全部 |

与现有权限逻辑一致，不新增权限规则。

## 技术方案

### 文件变更

| 文件 | 变更 |
|---|---|
| `src/app/(main)/overtime/page.tsx` | 增加 `page`、`userId` 参数解析，改用 skip/take 分页查询，传递分页 props |
| `src/app/(main)/overtime/client.tsx` | 增加员工筛选器、分页控件、更新 `updateFilter` 逻辑 |
| `src/app/(main)/leave/page.tsx` | 同 overtime/page.tsx |
| `src/app/(main)/leave/client.tsx` | 同 overtime/client.tsx |

不需要新增文件或修改数据库。
