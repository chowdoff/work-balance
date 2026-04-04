# 仪表盘增强设计

## 概述

当前仪表盘仅展示调休余额和年假余额两张卡片，信息单薄。本次增强将仪表盘扩展为信息中心，包含个人数据总览、部门概览、图表可视化，并根据角色提供不同程度的部门筛选能力。

## 页面布局

页面从上到下分为三个区域：

### 1. 个人区 — 我的余额 & 近期动态

所有角色可见，展示当前登录用户自己的数据。

**余额卡片行**（4 张卡片，网格排列）：

- 调休余额：remaining / total / used（现有）
- 年假余额：remaining / total / used（现有）
- 本年度累计加班天数：OvertimeRecord 按 workYearId 聚合
- 工作年度倒计时：剩余 X 天 / 共 Y 天，含 Tailwind CSS 进度条

**近期动态**（最近 5 条记录）：

- 混合 OvertimeRecord 和 LeaveRecord，按 date 降序取前 5
- 每条显示：日期、类型标签（加班/调休/年假，不同颜色）、天数、备注（截断）
- 列表底部「查看全部」链接，跳转到加班管理或请假管理页面

### 2. 部门区 — 部门概览

所有角色可见（员工未分配部门时隐藏此区域）。

**部门筛选器**（仅经理/管理员可见）：

- 使用现有 `DepartmentTreeSelect` 组件
- 通过 URL searchParams 传递 departmentId，服务端重新查询
- admin 额外有「全公司」选项作为默认值

**部门统计卡片行**（4 张卡片）：

- 部门人数
- 本月部门加班总天数
- 本月部门请假总天数
- 部门人均调休余额

**月度加班/请假趋势折线图**：

- 横轴：工作年度 startDate 到 endDate 覆盖的所有月份
- 纵轴：天数
- 两条折线：加班（一种颜色）、请假（另一种颜色，含调休+年假总和）
- 交互：hover 显示 tooltip，展示该月具体数值
- 空状态：无数据时显示占位提示文字

**团队余额排行柱状图**：

- 横轴：员工姓名，按调休余额降序排列
- 纵轴：天数
- 每个员工两根柱子：调休余额、年假余额，不同颜色区分
- 交互：hover 显示 tooltip
- 部门超过 15 人时图表区域可横向滚动

### 3. 快捷操作

卡片区域内嵌快捷入口按钮，跳转到加班管理、请假管理页面。

## 数据来源

| 展示内容 | 数据来源 | 查询方式 |
|---|---|---|
| 调休/年假余额 | LeaveBalance | 按 userId + workYearId + type 查询 |
| 累计加班天数 | OvertimeRecord | 按 userId + workYearId 聚合 sum(days) |
| 工作年度倒计时 | WorkYear | endDate 与今天的差值 |
| 近期动态 | OvertimeRecord + LeaveRecord | 按 userId + workYearId 混合查询，按 date 降序取前 5 |
| 部门统计卡片 | OvertimeRecord + LeaveRecord | 按部门成员 userId 列表 + workYearId 聚合，本月按 date 范围筛选 |
| 月度趋势折线图 | OvertimeRecord + LeaveRecord | 按部门成员 + workYearId，按月分组聚合 |
| 团队余额排行 | LeaveBalance + User | 按部门成员 + workYearId 查询，关联用户名 |

## 权限设计

| 角色 | 个人区 | 部门区 |
|---|---|---|
| employee | 自己的数据 | 固定显示所在部门，无筛选器；未分配部门则隐藏整个部门区 |
| manager | 自己的数据 | 默认显示管理的第一个部门，可通过部门树筛选器切换（仅限管理的部门） |
| admin | 自己的数据 | 默认显示全公司汇总，可通过部门树筛选器切换到任意部门 |

部门筛选器复用现有 `DepartmentTreeSelect` 组件和 `getAccessibleDepartmentTree` 工具函数。

## 技术方案

### 文件结构

将 dashboard 拆分为标准三文件结构：

- `page.tsx` — 服务端组件，查询所有数据，根据 searchParams 中的 departmentId 确定部门筛选
- `client.tsx` — 客户端组件，渲染图表（折线图、柱状图）、处理部门筛选器交互

不需要 `actions.ts`，仪表盘无数据变更操作。

### 图表库

使用 recharts，React 生态成熟的图表库。用于：

- 月度加班/请假趋势折线图（LineChart）
- 团队余额排行柱状图（BarChart）

### 进度条

工作年度倒计时进度条使用 Tailwind CSS 实现，不依赖图表库。
