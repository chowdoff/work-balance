# 个人设置入口移至右上角 + 修改姓名功能

## 概述

将个人设置入口从左侧导航链接移到页面右上角的用户头像下拉菜单中，同时在设置页面增加修改姓名功能。

## 设计决策

- **交互方式：** 用户头像（首字母）下拉菜单，包含用户信息、个人设置链接、退出登录
- **设置页面布局：** 修改姓名和修改密码两个卡片上下堆叠
- **数据刷新方式：** 修改姓名后通过 `revalidatePath` 刷新服务端数据，导航栏自动更新

## 变更详情

### 1. 导航栏改造 (`src/components/navbar.tsx`)

- 从 `navItems` 中移除"设置"链接
- 移除右上角独立的用户名文本和退出按钮
- 新增用户头像组件：
  - 圆形背景（紫色 `#6366f1`），显示用户姓名首字母
  - 点击弹出 `DropdownMenu`（使用 shadcn 组件）
- 下拉菜单内容：
  - 顶部区域：用户名 + 邮箱（只读展示）
  - "个人设置" — `<Link href="/settings">`
  - 分隔线
  - "退出登录" — 红色文字，调用 `signOut`
- `Navbar` 组件新增 `userEmail` prop

### 2. 布局层传递邮箱 (`src/app/(main)/layout.tsx`)

- 将 `user.email` 传递给 `Navbar` 组件的 `userEmail` prop

### 3. 设置页面重构

遵循项目三文件结构（`page.tsx` + `client.tsx` + `actions.ts`）。

#### `src/app/(main)/settings/page.tsx`（重构为服务端组件）

- 调用 `getCurrentUser()` 获取用户 `name` 和 `email`
- 将数据传递给 `SettingsClient` 客户端组件

#### `src/app/(main)/settings/client.tsx`（新增）

两个上下堆叠的 Card：

**修改姓名卡片（新增）：**
- 一个输入框，`defaultValue` 为当前姓名
- 提交按钮
- 成功/错误提示

**修改密码卡片（现有逻辑迁移）：**
- 当前密码、新密码、确认新密码三个输入框
- 提交按钮
- 成功/错误提示

#### `src/app/(main)/settings/actions.ts`（新增 action）

新增 `changeName` Server Action：
- 从 `formData` 获取 `name`
- 验证非空、长度限制
- 调用 `prisma.user.update` 更新 `name` 字段
- 调用 `revalidatePath("/settings")` 刷新页面

现有 `changePassword` 保持不变。

## 涉及文件清单

| 文件 | 操作 |
|------|------|
| `src/components/navbar.tsx` | 修改 |
| `src/app/(main)/layout.tsx` | 修改 |
| `src/app/(main)/settings/page.tsx` | 重构为服务端组件 |
| `src/app/(main)/settings/client.tsx` | 新增 |
| `src/app/(main)/settings/actions.ts` | 新增 `changeName` |
