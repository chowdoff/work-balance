# 考勤系统实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标：** 构建公司内部考勤系统，用于记录加班和请假（调休/年假），支持角色权限、部门树管理和统计报表。

**架构：** Next.js App Router 全栈单体应用。Prisma ORM + PostgreSQL。Server Actions 处理数据变更，NextAuth.js 处理认证。顶部导航栏布局，响应式设计。

**技术栈：** Next.js 14+, TypeScript, Tailwind CSS, shadcn/ui, Prisma, PostgreSQL, NextAuth.js, Docker

---

## 文件结构

```
prisma/
  schema.prisma                          # 所有数据模型定义
  seed.ts                                # 初始化管理员账号 + 默认工作年度

src/
  lib/
    prisma.ts                            # Prisma 客户端单例
    auth.ts                              # NextAuth 配置（账号密码登录）
    auth-utils.ts                        # getUserRole(), getManageDepartmentIds(), getAccessibleUserIds()
    department-tree.ts                   # getSubDepartmentIds(), getDepartmentTree()
    balance.ts                           # recalculateBalance() - 额度计算核心逻辑

  app/
    layout.tsx                           # 根布局（providers, 字体）
    page.tsx                             # 根路径重定向到仪表盘
    api/auth/[...nextauth]/route.ts      # NextAuth API 路由

    (auth)/
      login/page.tsx                     # 登录页

    (main)/
      layout.tsx                         # 主布局（顶部导航栏 + 内容区）
      dashboard/page.tsx                 # 仪表盘：当前年度余额
      overtime/
        page.tsx                         # 加班记录列表（员工只读 / 主管管理员增删改）
        actions.ts                       # Server actions: createOvertime, updateOvertime, deleteOvertime
        client.tsx                       # 客户端交互组件
      leave/
        page.tsx                         # 请假记录列表（员工只读 / 主管管理员增删改）
        actions.ts                       # Server actions: createLeave, updateLeave, deleteLeave
        client.tsx                       # 客户端交互组件
      statistics/
        page.tsx                         # 统计报表（服务端数据获取）
        client.tsx                       # 统计报表客户端交互
      organization/
        page.tsx                         # 组织管理：部门树 + 员工列表（仅管理员）
        actions.ts                       # 部门增删改、员工增删改、分配主管、设置年假
        client.tsx                       # 客户端交互组件
      work-year/
        page.tsx                         # 工作年度管理（仅管理员）
        actions.ts                       # 增删改工作年度、设为当前
        client.tsx                       # 客户端交互组件
      settings/
        page.tsx                         # 修改密码（所有用户）
        actions.ts                       # changePassword

  components/
    navbar.tsx                           # 顶部导航栏（按角色动态显示菜单）
    session-provider.tsx                 # NextAuth SessionProvider 包装
    department-tree-select.tsx           # 可复用的部门树下拉选择器

  types/
    next-auth.d.ts                       # NextAuth 类型扩展

  middleware.ts                          # 认证中间件

docker-compose.yml                       # PostgreSQL 服务
Dockerfile                               # 生产环境 Docker 镜像
.env                                     # DATABASE_URL, NEXTAUTH_SECRET
```

---

## 任务 1：项目脚手架与数据库初始化

**文件：**
- 创建：`package.json`, `docker-compose.yml`, `.env`, `prisma/schema.prisma`, `prisma/seed.ts`, `src/lib/prisma.ts`
- 创建：`tailwind.config.ts`, `tsconfig.json`, `next.config.ts`

- [ ] **步骤 1：初始化 Next.js 项目**

```bash
cd /home/cst/work-balance
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

接受默认选项。会创建带有 App Router、TypeScript、Tailwind CSS 的 Next.js 项目。

- [ ] **步骤 2：安装依赖**

```bash
npm install prisma @prisma/client next-auth@5 bcryptjs
npm install -D @types/bcryptjs
```

- [ ] **步骤 3：初始化 shadcn/ui**

```bash
npx shadcn@latest init -d
```

接受默认选项（New York 风格，Zinc 颜色，CSS 变量）。

- [ ] **步骤 4：添加需要的 shadcn 组件**

```bash
npx shadcn@latest add button card input label table dialog select dropdown-menu form toast tabs badge separator sheet
```

- [ ] **步骤 5：创建 docker-compose.yml**

```yaml
version: "3.8"
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: work-balance
      POSTGRES_PASSWORD: work-balance
      POSTGRES_DB: work-balance
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

- [ ] **步骤 6：创建 .env**

```env
DATABASE_URL="postgresql://work-balance:work-balance@localhost:5432/work-balance"
NEXTAUTH_SECRET="dev-secret-change-in-production"
NEXTAUTH_URL="http://localhost:3000"
```

- [ ] **步骤 7：初始化 Prisma**

```bash
npx prisma init
```

- [ ] **步骤 8：编写 prisma/schema.prisma**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id           String   @id @default(cuid())
  name         String
  email        String   @unique
  password     String
  isAdmin      Boolean  @default(false)
  departmentId String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  department        Department?       @relation("DepartmentMembers", fields: [departmentId], references: [id])
  managedDepartments Department[]     @relation("DepartmentManager")
  overtimeRecords   OvertimeRecord[]
  leaveRecords      LeaveRecord[]
  leaveBalances     LeaveBalance[]
}

model Department {
  id        String   @id @default(cuid())
  name      String
  parentId  String?
  managerId String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  parent   Department?  @relation("DepartmentTree", fields: [parentId], references: [id])
  children Department[] @relation("DepartmentTree")
  manager  User?        @relation("DepartmentManager", fields: [managerId], references: [id])
  members  User[]       @relation("DepartmentMembers")
}

model WorkYear {
  id        String   @id @default(cuid())
  name      String
  startDate DateTime
  endDate   DateTime
  isCurrent Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  overtimeRecords OvertimeRecord[]
  leaveRecords    LeaveRecord[]
  leaveBalances   LeaveBalance[]
}

enum LeaveType {
  COMPENSATORY
  ANNUAL
}

model OvertimeRecord {
  id         String   @id @default(cuid())
  userId     String
  workYearId String
  date       DateTime
  days       Decimal  @db.Decimal(3, 1)
  remark     String?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  user     User     @relation(fields: [userId], references: [id])
  workYear WorkYear @relation(fields: [workYearId], references: [id])
}

model LeaveRecord {
  id         String    @id @default(cuid())
  userId     String
  workYearId String
  type       LeaveType
  date       DateTime
  days       Decimal   @db.Decimal(3, 1)
  remark     String?
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt

  user     User     @relation(fields: [userId], references: [id])
  workYear WorkYear @relation(fields: [workYearId], references: [id])
}

model LeaveBalance {
  id         String    @id @default(cuid())
  userId     String
  workYearId String
  type       LeaveType
  total      Decimal   @default(0) @db.Decimal(5, 1)
  used       Decimal   @default(0) @db.Decimal(5, 1)
  remaining  Decimal   @default(0) @db.Decimal(5, 1)
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt

  user     User     @relation(fields: [userId], references: [id])
  workYear WorkYear @relation(fields: [workYearId], references: [id])

  @@unique([userId, workYearId, type])
}

model SystemConfig {
  key       String   @id
  value     String
  updatedAt DateTime @updatedAt
}
```

- [ ] **步骤 9：编写 prisma/seed.ts**

```typescript
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash("admin123", 12);

  await prisma.user.upsert({
    where: { email: "admin@company.com" },
    update: {},
    create: {
      name: "系统管理员",
      email: "admin@company.com",
      password: hashedPassword,
      isAdmin: true,
    },
  });

  const currentYear = new Date().getFullYear();
  const existingWorkYear = await prisma.workYear.findFirst({
    where: { isCurrent: true },
  });

  if (!existingWorkYear) {
    await prisma.workYear.create({
      data: {
        name: `${currentYear}年度`,
        startDate: new Date(`${currentYear}-01-01`),
        endDate: new Date(`${currentYear}-12-31`),
        isCurrent: true,
      },
    });
  }

  console.log("Seed completed: admin user + default work year created");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **步骤 10：在 package.json 中添加 seed 脚本**

在 `package.json` 中添加：
```json
{
  "prisma": {
    "seed": "npx tsx prisma/seed.ts"
  }
}
```

- [ ] **步骤 11：编写 src/lib/prisma.ts**

```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

- [ ] **步骤 12：启动数据库并运行迁移**

```bash
docker compose up -d
npx prisma migrate dev --name init
npx prisma db seed
```

预期结果：数据库创建成功，表结构就绪，管理员账号已初始化。

- [ ] **步骤 13：验证初始化**

```bash
npx prisma studio
```

打开 http://localhost:5555，确认 User 表有 admin@company.com，WorkYear 表有当前年度记录。

- [ ] **步骤 14：提交**

```bash
git init
echo "node_modules/\n.next/\n.env" > .gitignore
git add .
git commit -m "feat: project scaffolding with Prisma schema and seed"
```

---

## 任务 2：认证系统（NextAuth.js）

**文件：**
- 创建：`src/lib/auth.ts`, `src/app/api/auth/[...nextauth]/route.ts`, `src/app/(auth)/login/page.tsx`, `src/types/next-auth.d.ts`, `src/components/session-provider.tsx`, `src/middleware.ts`
- 修改：`src/app/layout.tsx`

- [ ] **步骤 1：编写 src/lib/auth.ts**

```typescript
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user) return null;

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!isValid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          isAdmin: user.isAdmin,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.isAdmin = (user as any).isAdmin;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as any).isAdmin = token.isAdmin as boolean;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
```

- [ ] **步骤 2：创建 NextAuth API 路由**

创建 `src/app/api/auth/[...nextauth]/route.ts`：

```typescript
import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
```

- [ ] **步骤 3：添加 NextAuth 类型扩展**

创建 `src/types/next-auth.d.ts`：

```typescript
import "next-auth";

declare module "next-auth" {
  interface User {
    isAdmin?: boolean;
  }
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      isAdmin: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    isAdmin: boolean;
  }
}
```

- [ ] **步骤 4：创建 SessionProvider 包装组件**

创建 `src/components/session-provider.tsx`：

```typescript
"use client";

import { SessionProvider as NextSessionProvider } from "next-auth/react";

export function SessionProvider({ children }: { children: React.ReactNode }) {
  return <NextSessionProvider>{children}</NextSessionProvider>;
}
```

- [ ] **步骤 5：更新根布局**

修改 `src/app/layout.tsx`，用 SessionProvider 包裹：

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/components/session-provider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "考勤系统",
  description: "公司内部加班、请假记录系统",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className={inter.className}>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
```

- [ ] **步骤 6：创建登录页**

创建 `src/app/(auth)/login/page.tsx`：

```tsx
"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const result = await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirect: false,
    });

    if (result?.error) {
      setError("邮箱或密码错误");
      setLoading(false);
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-center text-2xl">考勤系统</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">邮箱</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input id="password" name="password" type="password" required />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "登录中..." : "登录"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **步骤 7：添加认证中间件**

创建 `src/middleware.ts`：

```typescript
export { auth as middleware } from "@/lib/auth";

export const config = {
  matcher: ["/((?!api/auth|login|_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **步骤 8：验证登录功能**

```bash
npm run dev
```

打开 http://localhost:3000 — 应重定向到 /login。用 admin@company.com / admin123 登录 — 应重定向到 /dashboard（此时 404 正常，后续会实现）。

- [ ] **步骤 9：提交**

```bash
git add .
git commit -m "feat: authentication with NextAuth.js credentials provider"
```

---

## 任务 3：权限工具与部门树辅助函数

**文件：**
- 创建：`src/lib/auth-utils.ts`, `src/lib/department-tree.ts`, `src/lib/balance.ts`

- [ ] **步骤 1：编写 src/lib/auth-utils.ts**

```typescript
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export type UserRole = "admin" | "manager" | "employee";

export async function getCurrentUser() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session.user;
}

export async function getUserRole(userId: string): Promise<UserRole> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isAdmin: true },
  });

  if (user?.isAdmin) return "admin";

  const managedDepartment = await prisma.department.findFirst({
    where: { managerId: userId },
    select: { id: true },
  });

  if (managedDepartment) return "manager";

  return "employee";
}

export async function getManagedDepartmentIds(userId: string): Promise<string[]> {
  const departments = await prisma.department.findMany({
    where: { managerId: userId },
    select: { id: true },
  });

  if (departments.length === 0) return [];

  const { getSubDepartmentIds } = await import("@/lib/department-tree");
  const allIds: string[] = [];

  for (const dept of departments) {
    const subIds = await getSubDepartmentIds(dept.id);
    allIds.push(dept.id, ...subIds);
  }

  return [...new Set(allIds)];
}

export async function getAccessibleUserIds(userId: string, role: UserRole): Promise<string[] | "all"> {
  if (role === "admin") return "all";

  if (role === "manager") {
    const deptIds = await getManagedDepartmentIds(userId);
    const users = await prisma.user.findMany({
      where: { departmentId: { in: deptIds } },
      select: { id: true },
    });
    return users.map((u) => u.id);
  }

  return [userId];
}
```

- [ ] **步骤 2：编写 src/lib/department-tree.ts**

```typescript
import { prisma } from "@/lib/prisma";

export async function getSubDepartmentIds(departmentId: string): Promise<string[]> {
  const result = await prisma.$queryRaw<{ id: string }[]>`
    WITH RECURSIVE sub_departments AS (
      SELECT id FROM "Department" WHERE "parentId" = ${departmentId}
      UNION ALL
      SELECT d.id FROM "Department" d
      INNER JOIN sub_departments sd ON d."parentId" = sd.id
    )
    SELECT id FROM sub_departments
  `;

  return result.map((r) => r.id);
}

export type DepartmentNode = {
  id: string;
  name: string;
  parentId: string | null;
  managerId: string | null;
  managerName: string | null;
  children: DepartmentNode[];
};

export async function getDepartmentTree(): Promise<DepartmentNode[]> {
  const departments = await prisma.department.findMany({
    include: { manager: { select: { name: true } } },
    orderBy: { name: "asc" },
  });

  const map = new Map<string, DepartmentNode>();
  const roots: DepartmentNode[] = [];

  for (const dept of departments) {
    map.set(dept.id, {
      id: dept.id,
      name: dept.name,
      parentId: dept.parentId,
      managerId: dept.managerId,
      managerName: dept.manager?.name ?? null,
      children: [],
    });
  }

  for (const node of map.values()) {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}
```

- [ ] **步骤 3：编写 src/lib/balance.ts**

```typescript
import { prisma } from "@/lib/prisma";
import { LeaveType, Prisma } from "@prisma/client";

export async function recalculateCompensatoryBalance(
  userId: string,
  workYearId: string
) {
  const overtimeAgg = await prisma.overtimeRecord.aggregate({
    where: { userId, workYearId },
    _sum: { days: true },
  });

  const leaveAgg = await prisma.leaveRecord.aggregate({
    where: { userId, workYearId, type: LeaveType.COMPENSATORY },
    _sum: { days: true },
  });

  const total = overtimeAgg._sum.days ?? new Prisma.Decimal(0);
  const used = leaveAgg._sum.days ?? new Prisma.Decimal(0);
  const remaining = total.sub(used);

  await prisma.leaveBalance.upsert({
    where: {
      userId_workYearId_type: { userId, workYearId, type: LeaveType.COMPENSATORY },
    },
    update: { total, used, remaining },
    create: {
      userId,
      workYearId,
      type: LeaveType.COMPENSATORY,
      total,
      used,
      remaining,
    },
  });
}

export async function recalculateAnnualBalance(
  userId: string,
  workYearId: string
) {
  const existing = await prisma.leaveBalance.findUnique({
    where: {
      userId_workYearId_type: { userId, workYearId, type: LeaveType.ANNUAL },
    },
  });

  const total = existing?.total ?? new Prisma.Decimal(0);

  const leaveAgg = await prisma.leaveRecord.aggregate({
    where: { userId, workYearId, type: LeaveType.ANNUAL },
    _sum: { days: true },
  });

  const used = leaveAgg._sum.days ?? new Prisma.Decimal(0);
  const remaining = total.sub(used);

  await prisma.leaveBalance.upsert({
    where: {
      userId_workYearId_type: { userId, workYearId, type: LeaveType.ANNUAL },
    },
    update: { used, remaining },
    create: {
      userId,
      workYearId,
      type: LeaveType.ANNUAL,
      total,
      used,
      remaining,
    },
  });
}

export async function setAnnualLeaveTotal(
  userId: string,
  workYearId: string,
  totalDays: number
) {
  const total = new Prisma.Decimal(totalDays);

  const existing = await prisma.leaveBalance.findUnique({
    where: {
      userId_workYearId_type: { userId, workYearId, type: LeaveType.ANNUAL },
    },
  });

  const used = existing?.used ?? new Prisma.Decimal(0);
  const remaining = total.sub(used);

  await prisma.leaveBalance.upsert({
    where: {
      userId_workYearId_type: { userId, workYearId, type: LeaveType.ANNUAL },
    },
    update: { total, remaining },
    create: {
      userId,
      workYearId,
      type: LeaveType.ANNUAL,
      total,
      used,
      remaining,
    },
  });
}
```

- [ ] **步骤 4：验证编译**

```bash
npx tsc --noEmit
```

预期结果：无错误。

- [ ] **步骤 5：提交**

```bash
git add .
git commit -m "feat: auth utilities, department tree helpers, balance logic"
```

---

## 任务 4：主布局与导航栏

**文件：**
- 创建：`src/app/(main)/layout.tsx`, `src/components/navbar.tsx`

- [ ] **步骤 1：编写 src/components/navbar.tsx**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/lib/auth-utils";

type NavItem = {
  label: string;
  href: string;
  roles: UserRole[];
};

const navItems: NavItem[] = [
  { label: "仪表盘", href: "/dashboard", roles: ["admin", "manager", "employee"] },
  { label: "加班记录", href: "/overtime", roles: ["admin", "manager", "employee"] },
  { label: "请假记录", href: "/leave", roles: ["admin", "manager", "employee"] },
  { label: "统计报表", href: "/statistics", roles: ["admin", "manager"] },
  { label: "组织管理", href: "/organization", roles: ["admin"] },
  { label: "工作年度", href: "/work-year", roles: ["admin"] },
  { label: "设置", href: "/settings", roles: ["admin", "manager", "employee"] },
];

export function Navbar({
  userName,
  role,
}: {
  userName: string;
  role: UserRole;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const visibleItems = navItems.filter((item) => item.roles.includes(role));

  const NavLinks = ({ mobile }: { mobile?: boolean }) => (
    <>
      {visibleItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={() => mobile && setOpen(false)}
          className={cn(
            "text-sm font-medium transition-colors hover:text-primary",
            mobile ? "block py-2" : "",
            pathname.startsWith(item.href)
              ? "text-primary"
              : "text-muted-foreground"
          )}
        >
          {item.label}
        </Link>
      ))}
    </>
  );

  return (
    <header className="border-b bg-white">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <span className="text-lg font-bold">考勤系统</span>
          <nav className="hidden md:flex items-center gap-4">
            <NavLinks />
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden sm:inline text-sm text-muted-foreground">
            {userName}
          </span>
          <Button variant="outline" size="sm" onClick={() => signOut()}>
            退出
          </Button>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="sm">
                菜单
              </Button>
            </SheetTrigger>
            <SheetContent side="top" className="pt-10">
              <nav className="flex flex-col gap-1">
                <NavLinks mobile />
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
```

- [ ] **步骤 2：编写 src/app/(main)/layout.tsx**

```tsx
import { Navbar } from "@/components/navbar";
import { getCurrentUser, getUserRole } from "@/lib/auth-utils";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  const role = await getUserRole(user.id);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar userName={user.name} role={role} />
      <main className="container mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
```

- [ ] **步骤 3：验证布局渲染**

```bash
npm run dev
```

登录后确认顶部导航栏正常显示，菜单项按角色正确过滤。

- [ ] **步骤 4：提交**

```bash
git add .
git commit -m "feat: main layout with responsive top navbar"
```

---

## 任务 5：仪表盘页面

**文件：**
- 创建：`src/app/(main)/dashboard/page.tsx`

- [ ] **步骤 1：编写 src/app/(main)/dashboard/page.tsx**

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { LeaveType } from "@prisma/client";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  const currentWorkYear = await prisma.workYear.findFirst({
    where: { isCurrent: true },
  });

  if (!currentWorkYear) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        暂未设置当前工作年度，请联系管理员。
      </div>
    );
  }

  const compensatory = await prisma.leaveBalance.findUnique({
    where: {
      userId_workYearId_type: {
        userId: user.id,
        workYearId: currentWorkYear.id,
        type: LeaveType.COMPENSATORY,
      },
    },
  });

  const annual = await prisma.leaveBalance.findUnique({
    where: {
      userId_workYearId_type: {
        userId: user.id,
        workYearId: currentWorkYear.id,
        type: LeaveType.ANNUAL,
      },
    },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">
        {currentWorkYear.name}
      </h1>
      <div className="grid gap-4 sm:grid-cols-2 max-w-2xl">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              调休余额
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {compensatory?.remaining?.toString() ?? "0"} 天
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              总计 {compensatory?.total?.toString() ?? "0"} 天 / 已用{" "}
              {compensatory?.used?.toString() ?? "0"} 天
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              年假余额
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {annual?.remaining?.toString() ?? "0"} 天
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              总计 {annual?.total?.toString() ?? "0"} 天 / 已用{" "}
              {annual?.used?.toString() ?? "0"} 天
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

- [ ] **步骤 2：验证仪表盘渲染**

```bash
npm run dev
```

登录后访问 /dashboard，应显示两张余额卡片，数值均为 0 天。

- [ ] **步骤 3：提交**

```bash
git add .
git commit -m "feat: dashboard page with leave balance cards"
```

---

## 任务 6：工作年度管理（管理员）

**文件：**
- 创建：`src/app/(main)/work-year/page.tsx`, `src/app/(main)/work-year/actions.ts`, `src/app/(main)/work-year/client.tsx`

- [ ] **步骤 1：编写 src/app/(main)/work-year/actions.ts**

```typescript
"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser, getUserRole } from "@/lib/auth-utils";
import { revalidatePath } from "next/cache";

export async function createWorkYear(formData: FormData) {
  const user = await getCurrentUser();
  const role = await getUserRole(user.id);
  if (role !== "admin") throw new Error("无权限");

  const name = formData.get("name") as string;
  const startDate = formData.get("startDate") as string;
  const endDate = formData.get("endDate") as string;

  await prisma.workYear.create({
    data: {
      name,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    },
  });

  revalidatePath("/work-year");
}

export async function updateWorkYear(id: string, formData: FormData) {
  const user = await getCurrentUser();
  const role = await getUserRole(user.id);
  if (role !== "admin") throw new Error("无权限");

  const name = formData.get("name") as string;
  const startDate = formData.get("startDate") as string;
  const endDate = formData.get("endDate") as string;

  await prisma.workYear.update({
    where: { id },
    data: {
      name,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    },
  });

  revalidatePath("/work-year");
}

export async function setCurrentWorkYear(id: string) {
  const user = await getCurrentUser();
  const role = await getUserRole(user.id);
  if (role !== "admin") throw new Error("无权限");

  await prisma.$transaction([
    prisma.workYear.updateMany({
      where: { isCurrent: true },
      data: { isCurrent: false },
    }),
    prisma.workYear.update({
      where: { id },
      data: { isCurrent: true },
    }),
  ]);

  revalidatePath("/work-year");
  revalidatePath("/dashboard");
}

export async function deleteWorkYear(id: string) {
  const user = await getCurrentUser();
  const role = await getUserRole(user.id);
  if (role !== "admin") throw new Error("无权限");

  const workYear = await prisma.workYear.findUnique({ where: { id } });
  if (workYear?.isCurrent) throw new Error("不能删除当前工作年度");

  const hasRecords = await prisma.overtimeRecord.findFirst({
    where: { workYearId: id },
  });
  if (hasRecords) throw new Error("该年度下存在记录，无法删除");

  await prisma.workYear.delete({ where: { id } });
  revalidatePath("/work-year");
}
```

- [ ] **步骤 2：编写 src/app/(main)/work-year/page.tsx**

```tsx
import { prisma } from "@/lib/prisma";
import { getCurrentUser, getUserRole } from "@/lib/auth-utils";
import { redirect } from "next/navigation";
import { WorkYearClient } from "./client";

export default async function WorkYearPage() {
  const user = await getCurrentUser();
  const role = await getUserRole(user.id);
  if (role !== "admin") redirect("/dashboard");

  const workYears = await prisma.workYear.findMany({
    orderBy: { startDate: "desc" },
  });

  return <WorkYearClient workYears={JSON.parse(JSON.stringify(workYears))} />;
}
```

- [ ] **步骤 3：编写 src/app/(main)/work-year/client.tsx**

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  createWorkYear,
  updateWorkYear,
  setCurrentWorkYear,
  deleteWorkYear,
} from "./actions";

type WorkYear = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
};

export function WorkYearClient({ workYears }: { workYears: WorkYear[] }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  function openCreate() {
    setEditingId(null);
    setDialogOpen(true);
  }

  function openEdit(id: string) {
    setEditingId(id);
    setDialogOpen(true);
  }

  const editing = editingId
    ? workYears.find((w) => w.id === editingId)
    : null;

  async function handleSubmit(formData: FormData) {
    if (editingId) {
      await updateWorkYear(editingId, formData);
    } else {
      await createWorkYear(formData);
    }
    setDialogOpen(false);
  }

  async function handleSetCurrent(id: string) {
    await setCurrentWorkYear(id);
  }

  async function handleDelete(id: string) {
    if (!confirm("确定要删除此工作年度吗？")) return;
    try {
      await deleteWorkYear(id);
    } catch (e: any) {
      alert(e.message);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">工作年度管理</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>新建年度</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? "编辑年度" : "新建年度"}</DialogTitle>
            </DialogHeader>
            <form action={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">名称</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={editing?.name ?? ""}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="startDate">开始日期</Label>
                <Input
                  id="startDate"
                  name="startDate"
                  type="date"
                  defaultValue={editing?.startDate?.slice(0, 10) ?? ""}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">结束日期</Label>
                <Input
                  id="endDate"
                  name="endDate"
                  type="date"
                  defaultValue={editing?.endDate?.slice(0, 10) ?? ""}
                  required
                />
              </div>
              <Button type="submit" className="w-full">
                保存
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {workYears.map((wy) => (
          <Card key={wy.id}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                {wy.name}
                {wy.isCurrent && <Badge>当前</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                {wy.startDate.slice(0, 10)} ~ {wy.endDate.slice(0, 10)}
              </p>
              <div className="flex gap-2">
                {!wy.isCurrent && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSetCurrent(wy.id)}
                  >
                    设为当前
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openEdit(wy.id)}
                >
                  编辑
                </Button>
                {!wy.isCurrent && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(wy.id)}
                  >
                    删除
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **步骤 4：验证工作年度页面**

```bash
npm run dev
```

以管理员登录，访问 /work-year。测试新建工作年度、设为当前、编辑和删除功能。

- [ ] **步骤 5：提交**

```bash
git add .
git commit -m "feat: work year management page (admin)"
```

---

## 任务 7：组织管理（管理员）

**文件：**
- 创建：`src/app/(main)/organization/page.tsx`, `src/app/(main)/organization/actions.ts`, `src/app/(main)/organization/client.tsx`, `src/components/department-tree-select.tsx`

- [ ] **步骤 1：编写 src/components/department-tree-select.tsx**

```tsx
"use client";

import type { DepartmentNode } from "@/lib/department-tree";

function renderOptions(
  nodes: DepartmentNode[],
  depth: number = 0
): React.ReactNode[] {
  return nodes.flatMap((node) => [
    <option key={node.id} value={node.id}>
      {"　".repeat(depth)}
      {node.name}
    </option>,
    ...renderOptions(node.children, depth + 1),
  ]);
}

export function DepartmentTreeSelect({
  tree,
  value,
  onChange,
  name,
  allowEmpty,
  className,
}: {
  tree: DepartmentNode[];
  value?: string;
  onChange?: (value: string) => void;
  name?: string;
  allowEmpty?: boolean;
  className?: string;
}) {
  return (
    <select
      name={name}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      className={`flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm ${className ?? ""}`}
    >
      {allowEmpty && <option value="">全部部门</option>}
      {renderOptions(tree)}
    </select>
  );
}
```

- [ ] **步骤 2：编写 src/app/(main)/organization/actions.ts**

```typescript
"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser, getUserRole } from "@/lib/auth-utils";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";

async function requireAdmin() {
  const user = await getCurrentUser();
  const role = await getUserRole(user.id);
  if (role !== "admin") throw new Error("无权限");
}

// --- 部门管理 ---

export async function createDepartment(formData: FormData) {
  await requireAdmin();
  const name = formData.get("name") as string;
  const parentId = (formData.get("parentId") as string) || null;
  const managerId = (formData.get("managerId") as string) || null;

  await prisma.department.create({
    data: { name, parentId, managerId },
  });

  revalidatePath("/organization");
}

export async function updateDepartment(id: string, formData: FormData) {
  await requireAdmin();
  const name = formData.get("name") as string;
  const parentId = (formData.get("parentId") as string) || null;
  const managerId = (formData.get("managerId") as string) || null;

  await prisma.department.update({
    where: { id },
    data: { name, parentId, managerId },
  });

  revalidatePath("/organization");
}

export async function deleteDepartment(id: string) {
  await requireAdmin();

  const hasChildren = await prisma.department.findFirst({
    where: { parentId: id },
  });
  if (hasChildren) throw new Error("该部门下有子部门，无法删除");

  const hasMembers = await prisma.user.findFirst({
    where: { departmentId: id },
  });
  if (hasMembers) throw new Error("该部门下有员工，无法删除");

  await prisma.department.delete({ where: { id } });
  revalidatePath("/organization");
}

// --- 员工管理 ---

export async function createUser(formData: FormData) {
  await requireAdmin();
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const departmentId = (formData.get("departmentId") as string) || null;
  const annualLeave = parseFloat(formData.get("annualLeave") as string) || 0;

  const hashedPassword = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: { name, email, password: hashedPassword, departmentId },
  });

  // 如果设置了年假额度，写入当前工作年度
  if (annualLeave > 0) {
    const currentWorkYear = await prisma.workYear.findFirst({
      where: { isCurrent: true },
    });
    if (currentWorkYear) {
      const { setAnnualLeaveTotal } = await import("@/lib/balance");
      await setAnnualLeaveTotal(user.id, currentWorkYear.id, annualLeave);
    }
  }

  revalidatePath("/organization");
}

export async function updateUser(id: string, formData: FormData) {
  await requireAdmin();
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const departmentId = (formData.get("departmentId") as string) || null;
  const annualLeave = parseFloat(formData.get("annualLeave") as string) || 0;
  const newPassword = formData.get("newPassword") as string;

  const data: any = { name, email, departmentId };
  if (newPassword) {
    data.password = await bcrypt.hash(newPassword, 12);
  }

  await prisma.user.update({ where: { id }, data });

  // 更新当前工作年度的年假额度
  const currentWorkYear = await prisma.workYear.findFirst({
    where: { isCurrent: true },
  });
  if (currentWorkYear) {
    const { setAnnualLeaveTotal } = await import("@/lib/balance");
    await setAnnualLeaveTotal(id, currentWorkYear.id, annualLeave);
  }

  revalidatePath("/organization");
}

export async function deleteUser(id: string) {
  await requireAdmin();

  const user = await prisma.user.findUnique({ where: { id } });
  if (user?.isAdmin) throw new Error("不能删除管理员账号");

  // 移除部门主管关联
  await prisma.department.updateMany({
    where: { managerId: id },
    data: { managerId: null },
  });

  // 删除关联记录
  await prisma.$transaction([
    prisma.leaveRecord.deleteMany({ where: { userId: id } }),
    prisma.overtimeRecord.deleteMany({ where: { userId: id } }),
    prisma.leaveBalance.deleteMany({ where: { userId: id } }),
    prisma.user.delete({ where: { id } }),
  ]);

  revalidatePath("/organization");
}
```

- [ ] **步骤 3：编写 src/app/(main)/organization/page.tsx**

```tsx
import { prisma } from "@/lib/prisma";
import { getCurrentUser, getUserRole } from "@/lib/auth-utils";
import { getDepartmentTree } from "@/lib/department-tree";
import { redirect } from "next/navigation";
import { OrganizationClient } from "./client";
import { LeaveType } from "@prisma/client";

export default async function OrganizationPage() {
  const currentUser = await getCurrentUser();
  const role = await getUserRole(currentUser.id);
  if (role !== "admin") redirect("/dashboard");

  const tree = await getDepartmentTree();

  const users = await prisma.user.findMany({
    include: {
      department: { select: { name: true } },
    },
    orderBy: { name: "asc" },
  });

  const currentWorkYear = await prisma.workYear.findFirst({
    where: { isCurrent: true },
  });

  let annualLeaveMap: Record<string, number> = {};
  if (currentWorkYear) {
    const balances = await prisma.leaveBalance.findMany({
      where: { workYearId: currentWorkYear.id, type: LeaveType.ANNUAL },
    });
    for (const b of balances) {
      annualLeaveMap[b.userId] = Number(b.total);
    }
  }

  return (
    <OrganizationClient
      tree={tree}
      users={JSON.parse(JSON.stringify(users))}
      annualLeaveMap={annualLeaveMap}
    />
  );
}
```

- [ ] **步骤 4：编写 src/app/(main)/organization/client.tsx**

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DepartmentTreeSelect } from "@/components/department-tree-select";
import type { DepartmentNode } from "@/lib/department-tree";
import {
  createDepartment,
  updateDepartment,
  deleteDepartment,
  createUser,
  updateUser,
  deleteUser,
} from "./actions";

type UserData = {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  departmentId: string | null;
  department: { name: string } | null;
};

export function OrganizationClient({
  tree,
  users,
  annualLeaveMap,
}: {
  tree: DepartmentNode[];
  users: UserData[];
  annualLeaveMap: Record<string, number>;
}) {
  const [selectedDeptId, setSelectedDeptId] = useState<string>("");
  const [deptDialogOpen, setDeptDialogOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<DepartmentNode | null>(null);
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  const filteredUsers = selectedDeptId
    ? users.filter((u) => u.departmentId === selectedDeptId)
    : users;

  const editingUser = editingUserId
    ? users.find((u) => u.id === editingUserId)
    : null;

  const allUsers = users.filter((u) => !u.isAdmin);

  async function handleDeptSubmit(formData: FormData) {
    if (editingDept) {
      await updateDepartment(editingDept.id, formData);
    } else {
      await createDepartment(formData);
    }
    setDeptDialogOpen(false);
    setEditingDept(null);
  }

  async function handleUserSubmit(formData: FormData) {
    if (editingUserId) {
      await updateUser(editingUserId, formData);
    } else {
      await createUser(formData);
    }
    setUserDialogOpen(false);
    setEditingUserId(null);
  }

  function renderDeptTree(nodes: DepartmentNode[], depth = 0) {
    return nodes.map((node) => (
      <div key={node.id}>
        <div
          className={`flex items-center justify-between py-1.5 px-2 rounded cursor-pointer hover:bg-gray-100 ${
            selectedDeptId === node.id ? "bg-gray-100" : ""
          }`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => setSelectedDeptId(node.id)}
        >
          <div>
            <span className="text-sm font-medium">{node.name}</span>
            {node.managerName && (
              <span className="text-xs text-muted-foreground ml-2">
                主管: {node.managerName}
              </span>
            )}
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                setEditingDept(node);
                setDeptDialogOpen(true);
              }}
            >
              编辑
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-red-500"
              onClick={async (e) => {
                e.stopPropagation();
                if (!confirm("确定删除此部门？")) return;
                try {
                  await deleteDepartment(node.id);
                } catch (err: any) {
                  alert(err.message);
                }
              }}
            >
              删除
            </Button>
          </div>
        </div>
        {node.children.length > 0 && renderDeptTree(node.children, depth + 1)}
      </div>
    ));
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">组织管理</h1>
      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        {/* 左侧：部门树 */}
        <div className="border rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">部门</h2>
            <Button
              size="sm"
              onClick={() => {
                setEditingDept(null);
                setDeptDialogOpen(true);
              }}
            >
              新建
            </Button>
          </div>
          <div
            className="cursor-pointer py-1.5 px-2 rounded hover:bg-gray-100 text-sm mb-1"
            onClick={() => setSelectedDeptId("")}
          >
            全部员工
          </div>
          {renderDeptTree(tree)}
        </div>

        {/* 右侧：员工列表 */}
        <div className="border rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">
              员工 ({filteredUsers.length})
            </h2>
            <Button
              size="sm"
              onClick={() => {
                setEditingUserId(null);
                setUserDialogOpen(true);
              }}
            >
              新建员工
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>姓名</TableHead>
                <TableHead>邮箱</TableHead>
                <TableHead>部门</TableHead>
                <TableHead>角色</TableHead>
                <TableHead>年假</TableHead>
                <TableHead className="w-[100px]">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>{u.name}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>{u.department?.name ?? "-"}</TableCell>
                  <TableCell>
                    {u.isAdmin ? (
                      <Badge>管理员</Badge>
                    ) : tree.some(function findManager(nodes: DepartmentNode[]): boolean {
                        return nodes.some(
                          (n) =>
                            n.managerId === u.id ||
                            findManager(n.children)
                        );
                      }([...tree])) ? (
                      <Badge variant="secondary">主管</Badge>
                    ) : (
                      "员工"
                    )}
                  </TableCell>
                  <TableCell>
                    {annualLeaveMap[u.id] ?? 0} 天
                  </TableCell>
                  <TableCell>
                    {!u.isAdmin && (
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2"
                          onClick={() => {
                            setEditingUserId(u.id);
                            setUserDialogOpen(true);
                          }}
                        >
                          编辑
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-red-500"
                          onClick={async () => {
                            if (!confirm(`确定删除员工 ${u.name}？`)) return;
                            await deleteUser(u.id);
                          }}
                        >
                          删除
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* 部门对话框 */}
      <Dialog open={deptDialogOpen} onOpenChange={setDeptDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingDept ? "编辑部门" : "新建部门"}
            </DialogTitle>
          </DialogHeader>
          <form action={handleDeptSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>部门名称</Label>
              <Input
                name="name"
                defaultValue={editingDept?.name ?? ""}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>上级部门</Label>
              <DepartmentTreeSelect
                tree={tree}
                name="parentId"
                allowEmpty
              />
            </div>
            <div className="space-y-2">
              <Label>部门主管</Label>
              <select
                name="managerId"
                defaultValue={editingDept?.managerId ?? ""}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              >
                <option value="">无</option>
                {allUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" className="w-full">
              保存
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* 员工对话框 */}
      <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingUserId ? "编辑员工" : "新建员工"}
            </DialogTitle>
          </DialogHeader>
          <form action={handleUserSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>姓名</Label>
              <Input
                name="name"
                defaultValue={editingUser?.name ?? ""}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>邮箱</Label>
              <Input
                name="email"
                type="email"
                defaultValue={editingUser?.email ?? ""}
                required
              />
            </div>
            {!editingUserId && (
              <div className="space-y-2">
                <Label>密码</Label>
                <Input name="password" type="password" required />
              </div>
            )}
            {editingUserId && (
              <div className="space-y-2">
                <Label>新密码（留空不修改）</Label>
                <Input name="newPassword" type="password" />
              </div>
            )}
            <div className="space-y-2">
              <Label>所属部门</Label>
              <DepartmentTreeSelect
                tree={tree}
                name="departmentId"
                allowEmpty
              />
            </div>
            <div className="space-y-2">
              <Label>当前年度年假额度（天）</Label>
              <Input
                name="annualLeave"
                type="number"
                step="0.5"
                min="0"
                defaultValue={
                  editingUserId
                    ? annualLeaveMap[editingUserId] ?? 0
                    : 0
                }
              />
            </div>
            <Button type="submit" className="w-full">
              保存
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **步骤 5：验证组织管理页面**

```bash
npm run dev
```

以管理员登录，访问 /organization。测试：创建部门（含嵌套）、创建员工、分配部门、设置主管、设置年假额度。

- [ ] **步骤 6：提交**

```bash
git add .
git commit -m "feat: organization management with department tree and user CRUD"
```

---

## 任务 8：加班记录页面

**文件：**
- 创建：`src/app/(main)/overtime/page.tsx`, `src/app/(main)/overtime/actions.ts`, `src/app/(main)/overtime/client.tsx`

- [ ] **步骤 1：编写 src/app/(main)/overtime/actions.ts**

```typescript
"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser, getUserRole, getAccessibleUserIds } from "@/lib/auth-utils";
import { recalculateCompensatoryBalance } from "@/lib/balance";
import { revalidatePath } from "next/cache";

export async function createOvertime(formData: FormData) {
  const currentUser = await getCurrentUser();
  const role = await getUserRole(currentUser.id);
  if (role === "employee") throw new Error("无权限");

  const userId = formData.get("userId") as string;
  const workYearId = formData.get("workYearId") as string;
  const date = formData.get("date") as string;
  const days = parseFloat(formData.get("days") as string);
  const remark = (formData.get("remark") as string) || null;

  // 验证权限范围
  const accessible = await getAccessibleUserIds(currentUser.id, role);
  if (accessible !== "all" && !accessible.includes(userId)) {
    throw new Error("无权操作此员工");
  }

  await prisma.overtimeRecord.create({
    data: { userId, workYearId, date: new Date(date), days, remark },
  });

  await recalculateCompensatoryBalance(userId, workYearId);
  revalidatePath("/overtime");
  revalidatePath("/dashboard");
}

export async function updateOvertime(id: string, formData: FormData) {
  const currentUser = await getCurrentUser();
  const role = await getUserRole(currentUser.id);
  if (role === "employee") throw new Error("无权限");

  const record = await prisma.overtimeRecord.findUnique({ where: { id } });
  if (!record) throw new Error("记录不存在");

  const accessible = await getAccessibleUserIds(currentUser.id, role);
  if (accessible !== "all" && !accessible.includes(record.userId)) {
    throw new Error("无权操作");
  }

  const date = formData.get("date") as string;
  const days = parseFloat(formData.get("days") as string);
  const remark = (formData.get("remark") as string) || null;

  await prisma.overtimeRecord.update({
    where: { id },
    data: { date: new Date(date), days, remark },
  });

  await recalculateCompensatoryBalance(record.userId, record.workYearId);
  revalidatePath("/overtime");
  revalidatePath("/dashboard");
}

export async function deleteOvertime(id: string) {
  const currentUser = await getCurrentUser();
  const role = await getUserRole(currentUser.id);
  if (role === "employee") throw new Error("无权限");

  const record = await prisma.overtimeRecord.findUnique({ where: { id } });
  if (!record) throw new Error("记录不存在");

  const accessible = await getAccessibleUserIds(currentUser.id, role);
  if (accessible !== "all" && !accessible.includes(record.userId)) {
    throw new Error("无权操作");
  }

  await prisma.overtimeRecord.delete({ where: { id } });
  await recalculateCompensatoryBalance(record.userId, record.workYearId);
  revalidatePath("/overtime");
  revalidatePath("/dashboard");
}
```

- [ ] **步骤 2：编写 src/app/(main)/overtime/page.tsx**

```tsx
import { prisma } from "@/lib/prisma";
import { getCurrentUser, getUserRole, getAccessibleUserIds } from "@/lib/auth-utils";
import { OvertimeClient } from "./client";

export default async function OvertimePage() {
  const user = await getCurrentUser();
  const role = await getUserRole(user.id);

  const currentWorkYear = await prisma.workYear.findFirst({
    where: { isCurrent: true },
  });

  if (!currentWorkYear) {
    return <div className="text-center py-12 text-muted-foreground">暂未设置当前工作年度</div>;
  }

  const accessible = await getAccessibleUserIds(user.id, role);
  const whereClause = accessible === "all"
    ? { workYearId: currentWorkYear.id }
    : role === "employee"
      ? { workYearId: currentWorkYear.id, userId: user.id }
      : { workYearId: currentWorkYear.id, userId: { in: accessible } };

  const records = await prisma.overtimeRecord.findMany({
    where: whereClause,
    include: { user: { select: { name: true } } },
    orderBy: { date: "desc" },
  });

  // 主管/管理员：获取可管理的员工列表
  let manageableUsers: { id: string; name: string }[] = [];
  if (role !== "employee") {
    const userWhere = accessible === "all" ? {} : { id: { in: accessible } };
    manageableUsers = await prisma.user.findMany({
      where: userWhere,
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  }

  return (
    <OvertimeClient
      records={JSON.parse(JSON.stringify(records))}
      role={role}
      currentWorkYearId={currentWorkYear.id}
      currentWorkYearName={currentWorkYear.name}
      manageableUsers={manageableUsers}
    />
  );
}
```

- [ ] **步骤 3：编写 src/app/(main)/overtime/client.tsx**

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { UserRole } from "@/lib/auth-utils";
import { createOvertime, updateOvertime, deleteOvertime } from "./actions";

type OvertimeData = {
  id: string;
  userId: string;
  workYearId: string;
  date: string;
  days: string;
  remark: string | null;
  user: { name: string };
};

export function OvertimeClient({
  records,
  role,
  currentWorkYearId,
  currentWorkYearName,
  manageableUsers,
}: {
  records: OvertimeData[];
  role: UserRole;
  currentWorkYearId: string;
  currentWorkYearName: string;
  manageableUsers: { id: string; name: string }[];
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const canEdit = role !== "employee";

  const editing = editingId ? records.find((r) => r.id === editingId) : null;

  async function handleSubmit(formData: FormData) {
    formData.set("workYearId", currentWorkYearId);
    if (editingId) {
      await updateOvertime(editingId, formData);
    } else {
      await createOvertime(formData);
    }
    setDialogOpen(false);
    setEditingId(null);
  }

  async function handleDelete(id: string) {
    if (!confirm("确定删除此加班记录？")) return;
    await deleteOvertime(id);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">
          加班记录
          <span className="text-base font-normal text-muted-foreground ml-2">
            {currentWorkYearName}
          </span>
        </h1>
        {canEdit && (
          <Button
            onClick={() => {
              setEditingId(null);
              setDialogOpen(true);
            }}
          >
            新增加班
          </Button>
        )}
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>员工</TableHead>
              <TableHead>日期</TableHead>
              <TableHead>天数</TableHead>
              <TableHead>备注</TableHead>
              {canEdit && <TableHead className="w-[100px]">操作</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.length === 0 && (
              <TableRow>
                <TableCell colSpan={canEdit ? 5 : 4} className="text-center text-muted-foreground">
                  暂无记录
                </TableCell>
              </TableRow>
            )}
            {records.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.user.name}</TableCell>
                <TableCell>{r.date.slice(0, 10)}</TableCell>
                <TableCell>{r.days}</TableCell>
                <TableCell>{r.remark ?? "-"}</TableCell>
                {canEdit && (
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        onClick={() => {
                          setEditingId(r.id);
                          setDialogOpen(true);
                        }}
                      >
                        编辑
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-red-500"
                        onClick={() => handleDelete(r.id)}
                      >
                        删除
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "编辑加班" : "新增加班"}</DialogTitle>
          </DialogHeader>
          <form action={handleSubmit} className="space-y-4">
            {!editingId && (
              <div className="space-y-2">
                <Label>员工</Label>
                <select
                  name="userId"
                  required
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                >
                  {manageableUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-2">
              <Label>日期</Label>
              <Input
                name="date"
                type="date"
                defaultValue={editing?.date?.slice(0, 10) ?? ""}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>天数</Label>
              <Input
                name="days"
                type="number"
                step="0.5"
                min="0.5"
                defaultValue={editing?.days ?? "0.5"}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>备注</Label>
              <Input
                name="remark"
                defaultValue={editing?.remark ?? ""}
              />
            </div>
            <Button type="submit" className="w-full">
              保存
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **步骤 4：验证加班记录页面**

```bash
npm run dev
```

测试：管理员为员工创建加班记录，确认仪表盘余额自动更新。

- [ ] **步骤 5：提交**

```bash
git add .
git commit -m "feat: overtime records page with CRUD and balance integration"
```

---

## 任务 9：请假记录页面

**文件：**
- 创建：`src/app/(main)/leave/page.tsx`, `src/app/(main)/leave/actions.ts`, `src/app/(main)/leave/client.tsx`

- [ ] **步骤 1：编写 src/app/(main)/leave/actions.ts**

```typescript
"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser, getUserRole, getAccessibleUserIds } from "@/lib/auth-utils";
import { recalculateCompensatoryBalance, recalculateAnnualBalance } from "@/lib/balance";
import { LeaveType, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function createLeave(formData: FormData) {
  const currentUser = await getCurrentUser();
  const role = await getUserRole(currentUser.id);
  if (role === "employee") throw new Error("无权限");

  const userId = formData.get("userId") as string;
  const workYearId = formData.get("workYearId") as string;
  const type = formData.get("type") as LeaveType;
  const date = formData.get("date") as string;
  const days = parseFloat(formData.get("days") as string);
  const remark = (formData.get("remark") as string) || null;

  const accessible = await getAccessibleUserIds(currentUser.id, role);
  if (accessible !== "all" && !accessible.includes(userId)) {
    throw new Error("无权操作此员工");
  }

  // 检查额度
  const balance = await prisma.leaveBalance.findUnique({
    where: { userId_workYearId_type: { userId, workYearId, type } },
  });

  const remaining = balance?.remaining ?? new Prisma.Decimal(0);
  if (remaining.lt(new Prisma.Decimal(days))) {
    throw new Error(`额度不足，剩余 ${remaining} 天`);
  }

  await prisma.leaveRecord.create({
    data: { userId, workYearId, type, date: new Date(date), days, remark },
  });

  if (type === LeaveType.COMPENSATORY) {
    await recalculateCompensatoryBalance(userId, workYearId);
  } else {
    await recalculateAnnualBalance(userId, workYearId);
  }

  revalidatePath("/leave");
  revalidatePath("/dashboard");
}

export async function updateLeave(id: string, formData: FormData) {
  const currentUser = await getCurrentUser();
  const role = await getUserRole(currentUser.id);
  if (role === "employee") throw new Error("无权限");

  const record = await prisma.leaveRecord.findUnique({ where: { id } });
  if (!record) throw new Error("记录不存在");

  const accessible = await getAccessibleUserIds(currentUser.id, role);
  if (accessible !== "all" && !accessible.includes(record.userId)) {
    throw new Error("无权操作");
  }

  const date = formData.get("date") as string;
  const days = parseFloat(formData.get("days") as string);
  const remark = (formData.get("remark") as string) || null;

  // 检查额度（扣除当前记录后的可用额度）
  const balance = await prisma.leaveBalance.findUnique({
    where: {
      userId_workYearId_type: {
        userId: record.userId,
        workYearId: record.workYearId,
        type: record.type,
      },
    },
  });

  const currentRemaining = balance?.remaining ?? new Prisma.Decimal(0);
  const oldDays = record.days;
  const availableAfterRestore = currentRemaining.add(oldDays);

  if (availableAfterRestore.lt(new Prisma.Decimal(days))) {
    throw new Error(`额度不足，可用 ${availableAfterRestore} 天`);
  }

  await prisma.leaveRecord.update({
    where: { id },
    data: { date: new Date(date), days, remark },
  });

  if (record.type === LeaveType.COMPENSATORY) {
    await recalculateCompensatoryBalance(record.userId, record.workYearId);
  } else {
    await recalculateAnnualBalance(record.userId, record.workYearId);
  }

  revalidatePath("/leave");
  revalidatePath("/dashboard");
}

export async function deleteLeave(id: string) {
  const currentUser = await getCurrentUser();
  const role = await getUserRole(currentUser.id);
  if (role === "employee") throw new Error("无权限");

  const record = await prisma.leaveRecord.findUnique({ where: { id } });
  if (!record) throw new Error("记录不存在");

  const accessible = await getAccessibleUserIds(currentUser.id, role);
  if (accessible !== "all" && !accessible.includes(record.userId)) {
    throw new Error("无权操作");
  }

  await prisma.leaveRecord.delete({ where: { id } });

  if (record.type === LeaveType.COMPENSATORY) {
    await recalculateCompensatoryBalance(record.userId, record.workYearId);
  } else {
    await recalculateAnnualBalance(record.userId, record.workYearId);
  }

  revalidatePath("/leave");
  revalidatePath("/dashboard");
}
```

- [ ] **步骤 2：编写 src/app/(main)/leave/page.tsx**

```tsx
import { prisma } from "@/lib/prisma";
import { getCurrentUser, getUserRole, getAccessibleUserIds } from "@/lib/auth-utils";
import { LeaveClient } from "./client";

export default async function LeavePage() {
  const user = await getCurrentUser();
  const role = await getUserRole(user.id);

  const currentWorkYear = await prisma.workYear.findFirst({
    where: { isCurrent: true },
  });

  if (!currentWorkYear) {
    return <div className="text-center py-12 text-muted-foreground">暂未设置当前工作年度</div>;
  }

  const accessible = await getAccessibleUserIds(user.id, role);
  const whereClause = accessible === "all"
    ? { workYearId: currentWorkYear.id }
    : role === "employee"
      ? { workYearId: currentWorkYear.id, userId: user.id }
      : { workYearId: currentWorkYear.id, userId: { in: accessible } };

  const records = await prisma.leaveRecord.findMany({
    where: whereClause,
    include: { user: { select: { name: true } } },
    orderBy: { date: "desc" },
  });

  let manageableUsers: { id: string; name: string }[] = [];
  if (role !== "employee") {
    const userWhere = accessible === "all" ? {} : { id: { in: accessible } };
    manageableUsers = await prisma.user.findMany({
      where: userWhere,
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  }

  return (
    <LeaveClient
      records={JSON.parse(JSON.stringify(records))}
      role={role}
      currentWorkYearId={currentWorkYear.id}
      currentWorkYearName={currentWorkYear.name}
      manageableUsers={manageableUsers}
    />
  );
}
```

- [ ] **步骤 3：编写 src/app/(main)/leave/client.tsx**

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { UserRole } from "@/lib/auth-utils";
import { createLeave, updateLeave, deleteLeave } from "./actions";

type LeaveData = {
  id: string;
  userId: string;
  workYearId: string;
  type: "COMPENSATORY" | "ANNUAL";
  date: string;
  days: string;
  remark: string | null;
  user: { name: string };
};

const typeLabels = {
  COMPENSATORY: "调休",
  ANNUAL: "年假",
};

export function LeaveClient({
  records,
  role,
  currentWorkYearId,
  currentWorkYearName,
  manageableUsers,
}: {
  records: LeaveData[];
  role: UserRole;
  currentWorkYearId: string;
  currentWorkYearName: string;
  manageableUsers: { id: string; name: string }[];
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const canEdit = role !== "employee";

  const editing = editingId ? records.find((r) => r.id === editingId) : null;

  async function handleSubmit(formData: FormData) {
    formData.set("workYearId", currentWorkYearId);
    if (editingId) {
      await updateLeave(editingId, formData);
    } else {
      await createLeave(formData);
    }
    setDialogOpen(false);
    setEditingId(null);
  }

  async function handleDelete(id: string) {
    if (!confirm("确定删除此请假记录？")) return;
    try {
      await deleteLeave(id);
    } catch (e: any) {
      alert(e.message);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">
          请假记录
          <span className="text-base font-normal text-muted-foreground ml-2">
            {currentWorkYearName}
          </span>
        </h1>
        {canEdit && (
          <Button
            onClick={() => {
              setEditingId(null);
              setDialogOpen(true);
            }}
          >
            新增请假
          </Button>
        )}
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>员工</TableHead>
              <TableHead>类型</TableHead>
              <TableHead>日期</TableHead>
              <TableHead>天数</TableHead>
              <TableHead>备注</TableHead>
              {canEdit && <TableHead className="w-[100px]">操作</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.length === 0 && (
              <TableRow>
                <TableCell colSpan={canEdit ? 6 : 5} className="text-center text-muted-foreground">
                  暂无记录
                </TableCell>
              </TableRow>
            )}
            {records.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.user.name}</TableCell>
                <TableCell>
                  <Badge variant={r.type === "COMPENSATORY" ? "default" : "secondary"}>
                    {typeLabels[r.type]}
                  </Badge>
                </TableCell>
                <TableCell>{r.date.slice(0, 10)}</TableCell>
                <TableCell>{r.days}</TableCell>
                <TableCell>{r.remark ?? "-"}</TableCell>
                {canEdit && (
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        onClick={() => {
                          setEditingId(r.id);
                          setDialogOpen(true);
                        }}
                      >
                        编辑
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-red-500"
                        onClick={() => handleDelete(r.id)}
                      >
                        删除
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "编辑请假" : "新增请假"}</DialogTitle>
          </DialogHeader>
          <form action={handleSubmit} className="space-y-4">
            {!editingId && (
              <>
                <div className="space-y-2">
                  <Label>员工</Label>
                  <select
                    name="userId"
                    required
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  >
                    {manageableUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>类型</Label>
                  <select
                    name="type"
                    required
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  >
                    <option value="COMPENSATORY">调休</option>
                    <option value="ANNUAL">年假</option>
                  </select>
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label>日期</Label>
              <Input
                name="date"
                type="date"
                defaultValue={editing?.date?.slice(0, 10) ?? ""}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>天数</Label>
              <Input
                name="days"
                type="number"
                step="0.5"
                min="0.5"
                defaultValue={editing?.days ?? "0.5"}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>备注</Label>
              <Input name="remark" defaultValue={editing?.remark ?? ""} />
            </div>
            <Button type="submit" className="w-full">
              保存
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **步骤 4：验证请假记录页面**

```bash
npm run dev
```

测试：创建请假记录，验证额度检查（额度不足时拒绝），确认仪表盘余额更新。

- [ ] **步骤 5：提交**

```bash
git add .
git commit -m "feat: leave records page with CRUD and balance validation"
```

---

## 任务 10：统计报表页面

**文件：**
- 创建：`src/app/(main)/statistics/page.tsx`, `src/app/(main)/statistics/client.tsx`

- [ ] **步骤 1：编写 src/app/(main)/statistics/page.tsx**

```tsx
import { prisma } from "@/lib/prisma";
import { getCurrentUser, getUserRole, getManagedDepartmentIds } from "@/lib/auth-utils";
import { getDepartmentTree } from "@/lib/department-tree";
import { redirect } from "next/navigation";
import { StatisticsClient } from "./client";
import { LeaveType } from "@prisma/client";

export default async function StatisticsPage({
  searchParams,
}: {
  searchParams: Promise<{ departmentId?: string; workYearId?: string }>;
}) {
  const user = await getCurrentUser();
  const role = await getUserRole(user.id);
  if (role === "employee") redirect("/dashboard");

  const params = await searchParams;
  const tree = await getDepartmentTree();
  const workYears = await prisma.workYear.findMany({ orderBy: { startDate: "desc" } });
  const currentWorkYear = workYears.find((w) => w.isCurrent);
  const selectedWorkYearId = params.workYearId || currentWorkYear?.id;

  if (!selectedWorkYearId) {
    return <div className="text-center py-12 text-muted-foreground">暂未设置工作年度</div>;
  }

  // 确定可访问的部门范围
  let accessibleDeptIds: string[] | "all" = "all";
  if (role === "manager") {
    accessibleDeptIds = await getManagedDepartmentIds(user.id);
  }

  // 按选定部门或显示全部可访问范围
  let userWhere: any = {};
  if (params.departmentId) {
    // 验证访问权限
    if (accessibleDeptIds !== "all" && !accessibleDeptIds.includes(params.departmentId)) {
      redirect("/dashboard");
    }
    userWhere = { departmentId: params.departmentId };
  } else if (accessibleDeptIds !== "all") {
    userWhere = { departmentId: { in: accessibleDeptIds } };
  }

  const users = await prisma.user.findMany({
    where: userWhere,
    include: {
      department: { select: { name: true } },
      overtimeRecords: {
        where: { workYearId: selectedWorkYearId },
        select: { days: true },
      },
      leaveRecords: {
        where: { workYearId: selectedWorkYearId },
        select: { days: true, type: true },
      },
      leaveBalances: {
        where: { workYearId: selectedWorkYearId },
      },
    },
    orderBy: { name: "asc" },
  });

  const stats = users.map((u) => {
    const overtimeDays = u.overtimeRecords.reduce(
      (sum, r) => sum + Number(r.days),
      0
    );
    const compLeaveDays = u.leaveRecords
      .filter((r) => r.type === LeaveType.COMPENSATORY)
      .reduce((sum, r) => sum + Number(r.days), 0);
    const annualLeaveDays = u.leaveRecords
      .filter((r) => r.type === LeaveType.ANNUAL)
      .reduce((sum, r) => sum + Number(r.days), 0);

    const compBalance = u.leaveBalances.find(
      (b) => b.type === LeaveType.COMPENSATORY
    );
    const annualBalance = u.leaveBalances.find(
      (b) => b.type === LeaveType.ANNUAL
    );

    return {
      id: u.id,
      name: u.name,
      department: u.department?.name ?? "-",
      overtimeDays,
      compLeaveDays,
      compRemaining: Number(compBalance?.remaining ?? 0),
      annualLeaveDays,
      annualTotal: Number(annualBalance?.total ?? 0),
      annualRemaining: Number(annualBalance?.remaining ?? 0),
    };
  });

  // 主管只能查看自己管辖范围，但显示完整部门树（服务端已做权限控制）
  const filteredTree = accessibleDeptIds === "all"
    ? tree
    : tree;

  return (
    <StatisticsClient
      stats={stats}
      tree={filteredTree}
      workYears={JSON.parse(JSON.stringify(workYears))}
      selectedDepartmentId={params.departmentId ?? ""}
      selectedWorkYearId={selectedWorkYearId}
    />
  );
}
```

- [ ] **步骤 2：编写 src/app/(main)/statistics/client.tsx**

```tsx
"use client";

import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DepartmentTreeSelect } from "@/components/department-tree-select";
import type { DepartmentNode } from "@/lib/department-tree";

type StatRow = {
  id: string;
  name: string;
  department: string;
  overtimeDays: number;
  compLeaveDays: number;
  compRemaining: number;
  annualLeaveDays: number;
  annualTotal: number;
  annualRemaining: number;
};

type WorkYear = {
  id: string;
  name: string;
  isCurrent: boolean;
};

export function StatisticsClient({
  stats,
  tree,
  workYears,
  selectedDepartmentId,
  selectedWorkYearId,
}: {
  stats: StatRow[];
  tree: DepartmentNode[];
  workYears: WorkYear[];
  selectedDepartmentId: string;
  selectedWorkYearId: string;
}) {
  const router = useRouter();

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams();
    if (key === "departmentId") {
      if (value) params.set("departmentId", value);
      params.set("workYearId", selectedWorkYearId);
    } else {
      if (selectedDepartmentId) params.set("departmentId", selectedDepartmentId);
      if (value) params.set("workYearId", value);
    }
    router.push(`/statistics?${params.toString()}`);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">统计报表</h1>

      <div className="flex flex-wrap gap-4 mb-6">
        <div className="w-48">
          <DepartmentTreeSelect
            tree={tree}
            value={selectedDepartmentId}
            onChange={(v) => updateFilter("departmentId", v)}
            allowEmpty
          />
        </div>
        <div className="w-48">
          <select
            value={selectedWorkYearId}
            onChange={(e) => updateFilter("workYearId", e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          >
            {workYears.map((wy) => (
              <option key={wy.id} value={wy.id}>
                {wy.name}
                {wy.isCurrent ? " (当前)" : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>姓名</TableHead>
              <TableHead>部门</TableHead>
              <TableHead className="text-right">加班(天)</TableHead>
              <TableHead className="text-right">调休已用</TableHead>
              <TableHead className="text-right">调休余额</TableHead>
              <TableHead className="text-right">年假总计</TableHead>
              <TableHead className="text-right">年假已用</TableHead>
              <TableHead className="text-right">年假余额</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stats.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  暂无数据
                </TableCell>
              </TableRow>
            )}
            {stats.map((s) => (
              <TableRow key={s.id}>
                <TableCell>{s.name}</TableCell>
                <TableCell>{s.department}</TableCell>
                <TableCell className="text-right">{s.overtimeDays}</TableCell>
                <TableCell className="text-right">{s.compLeaveDays}</TableCell>
                <TableCell className="text-right">{s.compRemaining}</TableCell>
                <TableCell className="text-right">{s.annualTotal}</TableCell>
                <TableCell className="text-right">{s.annualLeaveDays}</TableCell>
                <TableCell className="text-right">{s.annualRemaining}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
```

- [ ] **步骤 3：验证统计报表页面**

```bash
npm run dev
```

以管理员登录，访问 /statistics。验证部门筛选和工作年度筛选是否正常，数据是否与加班/请假记录一致。

- [ ] **步骤 4：提交**

```bash
git add .
git commit -m "feat: statistics report page with department and year filters"
```

---

## 任务 11：设置页面（修改密码）

**文件：**
- 创建：`src/app/(main)/settings/page.tsx`, `src/app/(main)/settings/actions.ts`

- [ ] **步骤 1：编写 src/app/(main)/settings/actions.ts**

```typescript
"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-utils";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";

export async function changePassword(formData: FormData) {
  const user = await getCurrentUser();

  const currentPassword = formData.get("currentPassword") as string;
  const newPassword = formData.get("newPassword") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (newPassword !== confirmPassword) {
    throw new Error("两次输入的密码不一致");
  }

  if (newPassword.length < 6) {
    throw new Error("密码长度至少6位");
  }

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser) throw new Error("用户不存在");

  const isValid = await bcrypt.compare(currentPassword, dbUser.password);
  if (!isValid) throw new Error("当前密码错误");

  const hashedPassword = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashedPassword },
  });

  revalidatePath("/settings");
  return { success: true };
}
```

- [ ] **步骤 2：编写 src/app/(main)/settings/page.tsx**

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { changePassword } from "./actions";

export default function SettingsPage() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(formData: FormData) {
    setMessage("");
    setError("");
    try {
      await changePassword(formData);
      setMessage("密码修改成功");
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">个人设置</h1>
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="text-base">修改密码</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>当前密码</Label>
              <Input name="currentPassword" type="password" required />
            </div>
            <div className="space-y-2">
              <Label>新密码</Label>
              <Input name="newPassword" type="password" required minLength={6} />
            </div>
            <div className="space-y-2">
              <Label>确认新密码</Label>
              <Input name="confirmPassword" type="password" required minLength={6} />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            {message && <p className="text-sm text-green-600">{message}</p>}
            <Button type="submit">修改密码</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **步骤 3：验证设置页面**

```bash
npm run dev
```

测试正确和错误密码的修改场景。

- [ ] **步骤 4：提交**

```bash
git add .
git commit -m "feat: settings page with password change"
```

---

## 任务 12：Docker 部署与收尾

**文件：**
- 创建：`Dockerfile`, `src/app/page.tsx`
- 修改：`docker-compose.yml`, `next.config.ts`

- [ ] **步骤 1：创建 Dockerfile**

```dockerfile
FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

EXPOSE 3000
ENV PORT=3000

CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
```

- [ ] **步骤 2：更新 next.config.ts 启用 standalone 输出**

修改 `next.config.ts`：

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
};

export default nextConfig;
```

- [ ] **步骤 3：更新 docker-compose.yml 支持完整部署**

```yaml
version: "3.8"
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: work-balance
      POSTGRES_PASSWORD: work-balance
      POSTGRES_DB: work-balance
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: "postgresql://work-balance:work-balance@db:5432/work-balance"
      NEXTAUTH_SECRET: "change-this-in-production"
      NEXTAUTH_URL: "http://localhost:3000"
    depends_on:
      - db

volumes:
  pgdata:
```

- [ ] **步骤 4：测试 Docker 构建**

```bash
docker compose build
docker compose up -d
```

等待服务启动，打开 http://localhost:3000 验证登录功能。

- [ ] **步骤 5：提交**

```bash
git add .
git commit -m "feat: Docker deployment configuration"
```

- [ ] **步骤 6：添加根路径重定向到仪表盘**

创建 `src/app/page.tsx`：

```tsx
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/dashboard");
}
```

- [ ] **步骤 7：最终提交**

```bash
git add .
git commit -m "feat: redirect root to dashboard"
```
