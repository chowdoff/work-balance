# 考勤系统设计文档

公司内部加班、请假（调休、年假）记录系统。

## 概述

- **用户规模**：50-200人
- **核心功能**：加班记录、请假记录、调休/年假额度管理、统计报表
- **特点**：纯记录系统，无审批流程；加班和请假由部门主管/管理员录入，员工只读

## 技术栈

- **框架**：Next.js 14+ (App Router)
- **语言**：TypeScript
- **UI**：Tailwind CSS + shadcn/ui
- **ORM**：Prisma
- **数据库**：PostgreSQL
- **认证**：NextAuth.js（账号密码登录）
- **部署**：Docker 容器化

## 数据模型

### User（用户）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 主键 |
| name | string | 姓名 |
| email | string | 邮箱，唯一 |
| password | string | 密码 hash |
| departmentId | string | 所属部门 |
| isAdmin | boolean | 是否为管理员（系统仅一个） |
| createdAt | datetime | 创建时间 |

- 角色由系统自动决定：isAdmin 为管理员；被设为某部门主管则为主管；否则为普通员工
- 管理员在系统部署时通过 seed 自动生成

### Department（部门）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 主键 |
| name | string | 部门名称 |
| parentId | string? | 父部门 id，顶层为空 |
| managerId | string? | 部门主管用户 id |
| createdAt | datetime | 创建时间 |

- 树状结构，通过 parentId 实现邻接表
- 一个部门一个主管，一个人可以是多个部门的主管
- 设为主管时该用户自动获得主管权限（对该部门及所有子部门）

### WorkYear（工作年度）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 主键 |
| name | string | 名称，如"2026年度" |
| startDate | date | 开始日期 |
| endDate | date | 结束日期 |
| isCurrent | boolean | 是否为当前工作年度 |
| createdAt | datetime | 创建时间 |

- 管理员可设置当前工作年度，全局生效
- 员工登录后默认展示当前工作年度数据

### OvertimeRecord（加班记录）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 主键 |
| userId | string | 用户 id |
| workYearId | string | 工作年度 id |
| date | date | 加班日期 |
| days | decimal | 天数，最小粒度 0.5 天 |
| remark | string? | 备注 |
| createdAt | datetime | 创建时间 |

- 提交后自动累加到该用户当年度的调休额度

### LeaveRecord（请假记录）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 主键 |
| userId | string | 用户 id |
| workYearId | string | 工作年度 id |
| type | enum | 调休 / 年假 |
| date | date | 请假日期 |
| days | decimal | 天数，最小粒度 0.5 天 |
| remark | string? | 备注 |
| createdAt | datetime | 创建时间 |

- 提交时检查对应类型的剩余额度，不足则拒绝

### LeaveBalance（额度）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 主键 |
| userId | string | 用户 id |
| workYearId | string | 工作年度 id |
| type | enum | 调休 / 年假 |
| total | decimal | 总额度 |
| used | decimal | 已用额度 |
| remaining | decimal | 剩余额度 |

- 调休总额度：由该年度的加班记录自动累积（天数直接累加）
- 年假总额度：在组织管理中创建/编辑员工时由管理员分配
- 已用额度和剩余额度随请假记录增删自动更新

## 角色与权限

### 角色确定规则

- **管理员**：部署时 seed 自动生成，唯一，isAdmin = true
- **部门主管**：Department.managerId 指向该用户时自动获得主管权限
- **普通员工**：默认角色

### 权限矩阵

| 功能 | 普通员工 | 部门主管 | 管理员 |
|------|----------|----------|--------|
| 仪表盘（自己的余额） | 查看 | 查看 | 查看 |
| 加班记录（自己） | 只读 | 只读 | 只读 |
| 加班管理（部门） | - | 增删改 | 增删改（全部门） |
| 请假记录（自己） | 只读 | 只读 | 只读 |
| 请假管理（部门） | - | 增删改 | 增删改（全部门） |
| 统计报表 | - | 本部门及子部门 | 所有部门 |
| 组织管理 | - | - | 全部 |
| 工作年度管理 | - | - | 全部 |
| 系统设置 | - | - | 全部 |
| 个人设置（改密码） | 自己 | 自己 | 自己 |

## 页面结构

### 布局

- 登录页：独立布局
- 主应用：顶部导航栏 + 内容区，响应式（移动端导航栏自适应）

### 页面列表

```
(auth)/
  login                   # 登录页

(main)/
  dashboard/              # 仪表盘：当前年度调休余额、年假余额
  overtime/               # 加班记录（员工只读 / 主管管理员增删改）
  leave/                  # 请假记录（员工只读 / 主管管理员增删改）
  statistics/             # 统计报表（主管、管理员可见）
  organization/           # 组织管理：左侧部门树 + 右侧员工列表（管理员）
  work-year/              # 工作年度管理（管理员）
  settings/               # 系统设置（管理员） / 个人设置（所有人）
```

### 导航菜单（按角色动态显示）

- 所有人：仪表盘、加班记录、请假记录、个人设置
- 主管增加：统计报表
- 管理员增加：统计报表、组织管理、工作年度管理、系统设置

## 关键业务逻辑

### 加班 → 调休额度

1. 主管/管理员新增加班记录
2. 系统自动将加班天数累加到该用户当年度调休 LeaveBalance 的 total 字段
3. 删除加班记录时反向扣减 total
4. remaining = total - used，实时计算

### 请假扣减

1. 主管/管理员新增请假记录
2. 检查对应类型（调休/年假）的 remaining 是否 >= 请假天数
3. 不足则拒绝，充足则 used += days，remaining -= days
4. 删除请假记录时反向返还额度

### 部门树查询

- 邻接表 + 递归查询（PostgreSQL 的 WITH RECURSIVE）
- 主管权限范围：递归获取该部门及所有子部门的用户

## 项目结构

```
src/
  app/
    (auth)/login/         # 登录页
    (main)/               # 主布局（顶部导航栏）
      dashboard/
      overtime/
      leave/
      statistics/
      organization/
      work-year/
      settings/
    api/                  # API Routes
  components/             # 可复用 UI 组件
  lib/                    # 工具函数、权限判断、数据库操作
prisma/
  schema.prisma           # 数据模型定义
  seed.ts                 # 初始化：管理员账号 + 默认工作年度
docker-compose.yml        # PostgreSQL + 应用
```

## 初始化

通过 `prisma seed` 完成：
- 创建管理员账号（默认邮箱/密码，首次登录提示修改）
- 创建默认工作年度并设为当前
