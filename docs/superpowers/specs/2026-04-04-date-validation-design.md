# 加班/请假记录日期范围验证

## 概述

添加或编辑加班、请假记录时，日期必须在所属工作年度的起止时间范围内，否则无法提交。

## 设计

### 前端验证

**涉及文件：**
- `src/app/(main)/overtime/page.tsx`
- `src/app/(main)/overtime/client.tsx`
- `src/app/(main)/leave/page.tsx`
- `src/app/(main)/leave/client.tsx`

**改动：**
1. `page.tsx` 将当前工作年度的 `startDate` 和 `endDate` 格式化为 `YYYY-MM-DD` 字符串，通过 Props 传给客户端组件
2. 客户端组件 Props 新增 `workYearStartDate: string` 和 `workYearEndDate: string`
3. `<Input type="date">` 添加 `min={workYearStartDate}` 和 `max={workYearEndDate}` 属性
4. 浏览器原生阻止用户选择范围外的日期

### 后端验证

**涉及文件：**
- `src/app/(main)/overtime/actions.ts`
- `src/app/(main)/leave/actions.ts`

**改动：**
1. 在 `createOvertime`、`updateOvertime`、`createLeave`、`updateLeave` 中，查询对应 WorkYear 的 `startDate`/`endDate`
2. 校验提交的日期满足 `date >= startDate && date <= endDate`
3. 不通过时抛出错误：`"日期必须在工作年度范围内（YYYY-MM-DD ~ YYYY-MM-DD）"`

### 不涉及的内容

- 删除操作不需要日期验证（记录已存在）
- 不新增工具函数或文件，直接在现有 actions 中内联校验
