# Work Balance - 考勤管理系统

员工加班与调休管理系统，支持多级部门、工作年度、加班/请假记录与余额自动结算。

## 功能

- **仪表盘** — 个人加班/调休余额总览
- **加班管理** — 记录加班天数，自动累计调休额度
- **请假管理** — 调休假/年假申请与扣减
- **统计报表** — 按部门、年度汇总统计
- **组织管理** — 多级部门树 + 员工管理
- **工作年度** — 年度周期管理
- **个人设置** — 修改密码

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Next.js 16 (App Router) + React 19 |
| 语言 | TypeScript 5 |
| 数据库 | PostgreSQL 16 + Prisma 7 |
| 认证 | NextAuth v5 (Credentials) |
| UI | Tailwind CSS 4 + shadcn (Base UI) |
| 部署 | Docker + docker compose |

## 开发部署

### 前置条件

- Node.js >= 22
- PostgreSQL 16（或 Docker）

### 1. 克隆并安装依赖

```bash
git clone <repo-url>
cd work-balance
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env，按需修改数据库连接和管理员账号
```

### 3. 启动数据库

使用 Docker（推荐）：

```bash
docker compose up -d db
```

或连接已有的 PostgreSQL 实例，确保 `.env` 中的 `DATABASE_URL` 正确。

### 4. 初始化数据库

```bash
npx prisma generate
npx prisma migrate deploy
npx prisma db seed
```

### 5. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000，使用 `.env` 中配置的管理员账号登录。

> 局域网内其他设备访问：`npm run dev -- --hostname 0.0.0.0`

## 生产部署

### Docker Compose 部署

1. 修改 `docker-compose.yml` 中 app 服务的 `NEXTAUTH_SECRET`（使用 `openssl rand -base64 32` 生成安全密钥），按需修改数据库凭据。

2. 构建并启动服务：

```bash
docker compose up -d --build
```

app 会等待 PostgreSQL 健康检查通过后再启动，并自动执行数据库迁移和种子数据初始化（创建管理员账号和初始年度）。

3. 访问 http://localhost:3000，使用配置的管理员账号登录。

## 项目结构

```
src/
├── app/
│   ├── (auth)/login/       # 登录页
│   ├── (main)/             # 主应用（需认证）
│   │   ├── dashboard/      # 仪表盘
│   │   ├── overtime/       # 加班管理
│   │   ├── leave/          # 请假管理
│   │   ├── statistics/     # 统计报表
│   │   ├── organization/   # 组织管理
│   │   ├── work-year/      # 工作年度
│   │   └── settings/       # 个人设置
│   └── api/auth/           # NextAuth API
├── components/             # 共享组件
├── lib/                    # 工具库
└── proxy.ts                # 路由代理（认证拦截）
```

## 环境变量说明

| 变量 | 必填 | 说明 |
|------|------|------|
| `DATABASE_URL` | 是 | PostgreSQL 连接字符串 |
| `NEXTAUTH_SECRET` | 是 | NextAuth 加密密钥 |
| `SEED_ADMIN_EMAIL` | 否 | 种子管理员邮箱（默认 admin@company.com） |
| `SEED_ADMIN_PASSWORD` | 否 | 种子管理员密码（默认 admin123） |
| `SEED_ADMIN_NAME` | 否 | 种子管理员名称（默认 系统管理员） |
| `SEED_WORK_YEAR_NAME` | 否 | 初始年度名称（默认 {当前年}年度） |
| `SEED_WORK_YEAR_START` | 否 | 初始年度开始日期 |
| `SEED_WORK_YEAR_END` | 否 | 初始年度结束日期 |

## License

MIT
