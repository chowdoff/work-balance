# Work Balance - 考勤管理系统

## 项目概述

员工加班与调休管理系统，支持多级部门管理、工作年度管理、加班/请假记录与余额自动结算。

## 技术栈

- **框架**: Next.js 16 (App Router) + React 19 + TypeScript 5
- **数据库**: PostgreSQL 16 + Prisma 7 (使用 `@prisma/adapter-pg`)
- **认证**: NextAuth v5 (beta.30)，Credentials 模式
- **UI**: Tailwind CSS 4 + shadcn (Base UI) 组件
- **部署**: Docker + docker compose

## 项目结构

```
src/
├── app/
│   ├── (auth)/login/          # 登录页
│   ├── (main)/                # 需认证的主布局
│   │   ├── dashboard/         # 仪表盘
│   │   ├── overtime/          # 加班管理
│   │   ├── leave/             # 请假管理
│   │   ├── statistics/        # 统计报表
│   │   ├── organization/      # 组织管理（部门+员工）
│   │   ├── work-year/         # 工作年度管理
│   │   └── settings/          # 个人设置
│   └── api/auth/              # NextAuth API 路由
├── components/
│   ├── ui/                    # shadcn 组件（Base UI 实现）
│   ├── navbar.tsx             # 导航栏
│   ├── department-tree-select.tsx  # 部门树选择器
│   └── session-provider.tsx   # NextAuth Session Provider
├── lib/
│   ├── auth.ts                # NextAuth 主配置（含 Credentials Provider）
│   ├── auth.config.ts         # 认证路由配置（供 proxy 使用）
│   ├── auth-utils.ts          # 角色权限工具
│   ├── prisma.ts              # Prisma 客户端单例
│   ├── balance.ts             # 假期余额计算逻辑
│   ├── department-tree.ts     # 部门树构建工具
│   └── utils.ts               # 通用工具（cn 等）
├── types/
│   └── next-auth.d.ts         # NextAuth 类型扩展
└── proxy.ts                   # 路由代理（原 middleware）
```

## 开发约定

### 架构模式

每个功能模块遵循三文件结构：
- `page.tsx` — 服务端组件，获取数据并传递给客户端组件
- `client.tsx` — 客户端组件，处理交互逻辑和 UI
- `actions.ts` — Server Actions，处理数据变更，调用 `revalidatePath` 刷新页面

### 代码规范

- 代码和注释使用**英文**
- 文档使用**中文**
- 对话使用**中文**
- UI 组件来自 shadcn (Base UI 版本，非 Radix)，位于 `src/components/ui/`
- 使用 `@/*` 路径别名引用 `src/` 下的模块

### Next.js 16 注意事项

@AGENTS.md

- `src/proxy.ts` 替代了 `src/middleware.ts`（Next.js 16 重命名）
- `auth.config.ts` 独立于 `auth.ts`，因为 proxy 运行在 Edge Runtime，不能引入 bcrypt 等 Node.js 模块

### 数据库

- Schema 定义在 `prisma/schema.prisma`
- 迁移文件在 `prisma/migrations/`
- 种子数据在 `prisma/seed.ts`，管理员账号和初始年度从环境变量读取
- 修改 schema 后运行 `npx prisma migrate dev --name <描述>`

### 认证与权限

三种角色：`admin`（管理员）、`manager`（部门经理）、`employee`（普通员工）
- admin: 可访问所有功能
- manager: 可查看部门统计
- employee: 仅管理自己的记录

### 已知的 Base UI 注意事项

Dialog 内使用 `defaultValue` 的表单，需要：
1. 在 `<form>` 上添加 `key={editingId ?? "new"}` — 切换创建/编辑模式时强制重新挂载
2. 提交后重置 `editingId` 为 `null` — 防止 `revalidatePath` 刷新数据后 `defaultValue` 变化触发 `useControlled` 警告

## 环境变量

复制 `.env.example` 为 `.env` 并填写：

```bash
# 数据库连接
DATABASE_URL="postgresql://work-balance:work-balance@db:5432/work-balance"

# NextAuth
NEXTAUTH_SECRET="生成一个安全的随机字符串"

# 种子数据 - 管理员账号
SEED_ADMIN_EMAIL="admin@company.com"
SEED_ADMIN_PASSWORD="admin123"
SEED_ADMIN_NAME="系统管理员"

# 种子数据 - 初始工作年度（不设置则使用当前年份）
SEED_WORK_YEAR_NAME="2026年度"
SEED_WORK_YEAR_START="2026-01-01"
SEED_WORK_YEAR_END="2026-12-31"
```

## 常用命令

```bash
npm run dev -- --hostname 0.0.0.0  # 启动开发服务器（局域网可访问）
npm run build                       # 生产构建
npm run lint                        # ESLint 检查
npx prisma migrate dev --name xxx   # 创建数据库迁移
npx prisma db seed                  # 执行种子数据
npx prisma studio                   # 打开数据库管理界面
docker compose up -d db             # 仅启动数据库（开发环境）
docker compose up -d --build        # 构建并启动完整应用（自动 migrate + seed）
# 生产环境包含 Nginx Proxy Manager，管理面板：http://<IP>:81
```
