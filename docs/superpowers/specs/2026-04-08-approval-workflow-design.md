# 审批流程设计

## 概述

为考勤管理系统增加审批流程，使员工可主动发起加班/请假申请，由部门负责人审批。与此同时，管理员/经理直接录入记录的能力保留（双轨并行）。

## 核心决策

| 决策点 | 选择 |
|--------|------|
| 直接录入能力 | 保留，双轨并行 |
| 审批层级 | 单级（部门负责人审批，admin 可审批所有） |
| 请假额度预扣 | 提交时预扣，拒绝/撤回时释放 |
| 加班额度 | 不预扣，审批通过后创建记录并重算余额 |
| 撤回/重提 | PENDING 状态可撤回，被拒绝后只能新建 |
| 通知方式 | 页面内角标提醒（导航栏待审批数量） |
| 页面入口 | 独立"审批管理"页面，Tab 切换不同视图 |

## 数据模型

### 新增枚举

```prisma
enum ApprovalType {
  OVERTIME    // 加班申请
  LEAVE       // 请假申请
}

enum ApprovalStatus {
  PENDING     // 待审批
  APPROVED    // 已通过
  REJECTED    // 已拒绝
  WITHDRAWN   // 已撤回
}
```

### 新增模型：ApprovalRequest

```prisma
model ApprovalRequest {
  id           String         @id @default(cuid())
  type         ApprovalType
  status       ApprovalStatus @default(PENDING)

  // 申请人
  applicantId  String
  applicant    User           @relation("Applicant", fields: [applicantId], references: [id])

  // 审批人（审批后填入）
  approverId   String?
  approver     User?          @relation("Approver", fields: [approverId], references: [id])

  // 业务字段
  workYearId   String
  workYear     WorkYear       @relation(fields: [workYearId], references: [id])
  date         DateTime
  days         Decimal        @db.Decimal(3, 1)
  leaveType    LeaveType?     // 仅请假时填写
  remark       String?
  rejectReason String?

  // 审批通过后关联的记录
  overtimeRecordId String?          @unique
  overtimeRecord   OvertimeRecord?  @relation(fields: [overtimeRecordId], references: [id])
  leaveRecordId    String?          @unique
  leaveRecord      LeaveRecord?     @relation(fields: [leaveRecordId], references: [id])

  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt
}
```

### 现有模型变更

**User** 新增反向关系：
```prisma
appliedRequests   ApprovalRequest[] @relation("Applicant")
approvedRequests  ApprovalRequest[] @relation("Approver")
```

**WorkYear** 新增反向关系：
```prisma
approvalRequests  ApprovalRequest[]
```

**OvertimeRecord** 新增反向关系：
```prisma
approvalRequest   ApprovalRequest?
```

**LeaveRecord** 新增反向关系：
```prisma
approvalRequest   ApprovalRequest?
```

## 审批流程逻辑

### 员工提交申请

**加班申请：**
1. 验证日期在工作年度范围内
2. 创建 `ApprovalRequest`（type=OVERTIME, status=PENDING）
3. 不影响任何余额

**请假申请：**
1. 验证日期在工作年度范围内
2. 检查对应假期类型余额是否 >= 申请天数
3. 预扣额度：立即更新 `LeaveBalance`，`used += days`，`remaining -= days`
4. 创建 `ApprovalRequest`（type=LEAVE, status=PENDING）

### 员工撤回申请

- 仅 `PENDING` 状态可撤回，状态改为 `WITHDRAWN`
- 请假申请释放预扣额度：调用 recalculate 重算余额

### 审批人通过

**通过加班申请：**
1. 状态改为 `APPROVED`，写入 `approverId`
2. 创建 `OvertimeRecord`，关联回 `overtimeRecordId`
3. 调用 `recalculateCompensatoryBalance` 重算余额

**通过请假申请：**
1. 状态改为 `APPROVED`，写入 `approverId`
2. 创建 `LeaveRecord`，关联回 `leaveRecordId`
3. 调用 recalculate 保持余额一致性（额度已在提交时预扣）

### 审批人拒绝

1. 状态改为 `REJECTED`，写入 `approverId` 和 `rejectReason`
2. 请假申请释放预扣额度：调用 recalculate 重算余额

### 审批人确定规则

- 申请人所在部门的 `managerId` 对应的用户即为审批人
- 如果申请人所在部门没有负责人，向上查找父部门的负责人
- 如果整个部门链上都没有负责人，或员工未分配部门，则只有 admin 可审批
- `admin` 可以审批任何申请

## 预扣额度一致性保障

修改 `src/lib/balance.ts` 中的余额重算逻辑，计算 `used` 时同时考虑：
- `LeaveRecord` 中已生效的请假记录（现有逻辑）
- `ApprovalRequest` 中 `PENDING` 状态的请假申请天数（新增）

即 `used = 已生效请假天数 + 待审批预扣天数`，`remaining = total - used`。

这样无论是直接录入/删除记录，还是提交/撤回/审批申请，只要调用 recalculate，余额都是正确的。

## 页面结构

### 新增路由：`/approval`

遵循项目三文件结构约定：
- `src/app/(main)/approval/page.tsx` — 服务端组件
- `src/app/(main)/approval/client.tsx` — 客户端组件
- `src/app/(main)/approval/actions.ts` — Server Actions

### Tab 视图

**Tab 1 — 我的申请**（所有角色可见）
- 查看自己提交的所有申请
- 顶部"发起加班申请"和"发起请假申请"按钮
- 表格列：申请类型、日期、天数、假期类型（请假时）、状态、审批人、备注、操作
- PENDING 状态显示"撤回"按钮
- 支持按状态筛选

**Tab 2 — 待我审批**（manager/admin 可见）
- 显示需当前用户审批的 PENDING 申请
- 表格列：申请人、部门、申请类型、日期、天数、假期类型、备注、操作
- 操作：通过 / 拒绝（拒绝弹出 Dialog 填写原因）

**Tab 3 — 审批记录**（manager/admin 可见）
- 已处理的申请（APPROVED/REJECTED）
- 表格列：申请人、部门、申请类型、日期、天数、状态、处理时间

### 申请表单 Dialog

加班/请假共用 Dialog，根据类型显示不同字段：
- 共有：工作年度（默认当前）、日期、天数、备注
- 请假独有：假期类型选择（调休/年假）

### 导航栏角标

- 在"审批管理"菜单项旁显示待审批数量
- 仅 manager/admin 有待办时显示
- 数据在 `layout.tsx` 中查询并传入 `Navbar`

## 对现有功能的影响

### 需要改动

| 文件 | 改动内容 |
|------|----------|
| `prisma/schema.prisma` | 新增枚举、模型、反向关系 |
| `src/lib/balance.ts` | 重算逻辑加入 PENDING 申请预扣天数 |
| `src/components/navbar.tsx` | 新增菜单项 + 角标 |
| `src/app/(main)/layout.tsx` | 查询待审批数量传入 Navbar |

### 不需要改动

- 加班/请假记录页面（`/overtime`、`/leave`）
- 仪表盘（`/dashboard`）
- 统计报表（`/statistics`）
- 组织管理、工作年度等其他页面
