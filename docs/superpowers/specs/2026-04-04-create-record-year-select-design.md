# 新增记录时选择年度

## 概述

新增加班、请假记录时，用户可以在对话框中选择目标工作年度（而非固定使用页面筛选器的年度）。选择年度后，日期输入的可选范围动态联动。

## 设计

加班和请假两个模块改动完全对称。

### page.tsx 改动（overtime + leave）

- `workYears` 传给客户端时，每个年度对象增加 `startDate` 和 `endDate` 字段（格式化为 `YYYY-MM-DD` 字符串）
- 移除 `workYearStartDate` 和 `workYearEndDate` 独立 props（不再需要）

### client.tsx 改动（overtime + leave）

**类型变化：**
- `WorkYear` 类型新增 `startDate: string` 和 `endDate: string`
- Props 移除 `workYearStartDate` 和 `workYearEndDate`

**状态管理：**
- 新增 `useState`：`formWorkYearId`，默认值为 `selectedWorkYearId`
- `openCreate` 时重置 `formWorkYearId` 为 `selectedWorkYearId`

**表单 UI：**
- 将 `<input type="hidden" name="workYearId">` 替换为：
  - 新增模式（`!editingId`）：可见的年度 `<select name="workYearId">`，值绑定 `formWorkYearId`，`onChange` 更新 `formWorkYearId`
  - 编辑模式：保持 hidden field（年度不可改，使用记录原有年度）
- 日期 `<Input>` 的 `min`/`max`：从 `workYears` 数组中按 `formWorkYearId`（新增）或记录的 `workYearId`（编辑）查找对应年度的 `startDate`/`endDate`

### 不涉及的内容

- 后端 actions 不需要改动（已有日期范围校验）
- 统计页面不涉及
