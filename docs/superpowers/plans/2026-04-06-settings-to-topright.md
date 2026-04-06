# 个人设置入口移至右上角 + 修改姓名 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将个人设置入口从左侧导航移到右上角用户头像下拉菜单，并在设置页面新增修改姓名功能。

**Architecture:** 导航栏右上角替换为头像+下拉菜单组件，使用现有 shadcn DropdownMenu。设置页面重构为三文件结构（page.tsx + client.tsx + actions.ts），新增 changeName Server Action。

**Tech Stack:** Next.js App Router, shadcn DropdownMenu (Base UI), lucide-react icons, Prisma, Server Actions

---

## File Structure

| 文件 | 操作 | 职责 |
|------|------|------|
| `src/app/(main)/settings/actions.ts` | 修改 | 新增 `changeName` Server Action |
| `src/app/(main)/settings/client.tsx` | 新增 | 设置页客户端组件（修改姓名 + 修改密码卡片） |
| `src/app/(main)/settings/page.tsx` | 重构 | 服务端组件，获取用户数据传给 client |
| `src/app/(main)/layout.tsx` | 修改 | 传递 `userEmail` 给 Navbar |
| `src/components/navbar.tsx` | 修改 | 移除"设置"导航链接，右上角替换为头像下拉菜单 |

---

### Task 1: 新增 changeName Server Action

**Files:**
- Modify: `src/app/(main)/settings/actions.ts`

- [ ] **Step 1: 在 actions.ts 中新增 changeName 函数**

在现有 `changePassword` 函数之后添加：

```typescript
export async function changeName(formData: FormData) {
  const user = await getCurrentUser();

  const name = (formData.get("name") as string)?.trim();

  if (!name) {
    throw new Error("姓名不能为空");
  }

  if (name.length > 50) {
    throw new Error("姓名不能超过50个字符");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { name },
  });

  revalidatePath("/settings");
  return { success: true };
}
```

- [ ] **Step 2: 验证构建**

Run: `npx next build 2>&1 | tail -20`
Expected: 构建成功，无类型错误

- [ ] **Step 3: Commit**

```bash
git add src/app/(main)/settings/actions.ts
git commit -m "feat(settings): add changeName server action"
```

---

### Task 2: 创建设置页客户端组件

**Files:**
- Create: `src/app/(main)/settings/client.tsx`

- [ ] **Step 1: 创建 client.tsx**

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { changeName, changePassword } from "./actions";

export function SettingsClient({ userName }: { userName: string }) {
  const [nameMessage, setNameMessage] = useState("");
  const [nameError, setNameError] = useState("");
  const [pwdMessage, setPwdMessage] = useState("");
  const [pwdError, setPwdError] = useState("");

  async function handleNameSubmit(formData: FormData) {
    setNameMessage("");
    setNameError("");
    try {
      await changeName(formData);
      setNameMessage("姓名修改成功");
    } catch (e: unknown) {
      setNameError(e instanceof Error ? e.message : "修改失败");
    }
  }

  async function handlePasswordSubmit(formData: FormData) {
    setPwdMessage("");
    setPwdError("");
    try {
      await changePassword(formData);
      setPwdMessage("密码修改成功");
    } catch (e: unknown) {
      setPwdError(e instanceof Error ? e.message : "修改失败");
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">个人设置</h1>

      <div className="space-y-6 max-w-md">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">修改姓名</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={handleNameSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>姓名</Label>
                <Input name="name" required defaultValue={userName} maxLength={50} />
              </div>
              {nameError && <p className="text-sm text-red-500">{nameError}</p>}
              {nameMessage && <p className="text-sm text-green-600">{nameMessage}</p>}
              <Button type="submit">保存</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">修改密码</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={handlePasswordSubmit} className="space-y-4">
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
              {pwdError && <p className="text-sm text-red-500">{pwdError}</p>}
              {pwdMessage && <p className="text-sm text-green-600">{pwdMessage}</p>}
              <Button type="submit">修改密码</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/(main)/settings/client.tsx
git commit -m "feat(settings): add settings client component with name and password forms"
```

---

### Task 3: 重构设置页为服务端组件

**Files:**
- Modify: `src/app/(main)/settings/page.tsx`

- [ ] **Step 1: 将 page.tsx 重构为服务端组件**

替换整个文件内容：

```tsx
import { getCurrentUser } from "@/lib/auth-utils";
import { SettingsClient } from "./client";

export default async function SettingsPage() {
  const user = await getCurrentUser();

  return <SettingsClient userName={user.name ?? ""} />;
}
```

- [ ] **Step 2: 验证构建**

Run: `npx next build 2>&1 | tail -20`
Expected: 构建成功

- [ ] **Step 3: Commit**

```bash
git add src/app/(main)/settings/page.tsx
git commit -m "refactor(settings): convert page to server component with client split"
```

---

### Task 4: 改造导航栏 — 传递 email 并替换右上角为头像下拉菜单

**Files:**
- Modify: `src/app/(main)/layout.tsx`
- Modify: `src/components/navbar.tsx`

- [ ] **Step 1: layout.tsx 传递 userEmail**

将 `layout.tsx` 中的 Navbar 调用修改为：

```tsx
<Navbar userName={user.name ?? user.email ?? "用户"} userEmail={user.email ?? ""} role={role} />
```

- [ ] **Step 2: 改造 navbar.tsx**

替换整个文件内容：

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { SettingsIcon, LogOutIcon } from "lucide-react";
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
];

function NavLinks({
  items,
  pathname,
  mobile,
  onClose,
}: {
  items: NavItem[];
  pathname: string;
  mobile?: boolean;
  onClose?: () => void;
}) {
  return (
    <>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={() => mobile && onClose?.()}
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
}

export function Navbar({
  userName,
  userEmail,
  role,
}: {
  userName: string;
  userEmail: string;
  role: UserRole;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const visibleItems = navItems.filter((item) => item.roles.includes(role));

  const initials = userName.charAt(0).toUpperCase();

  return (
    <header className="border-b bg-white">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-2">
            <img src="/logo.svg" alt="Work Balance" className="h-7 w-7" />
            <span className="text-lg font-bold">Work Balance</span>
          </Link>
          <nav className="hidden md:flex items-center gap-4">
            <NavLinks items={visibleItems} pathname={pathname} />
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500 text-sm font-medium text-white hover:bg-indigo-600 focus:outline-none" />
              }
            >
              {initials}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={8} className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium leading-none">{userName}</p>
                  <p className="text-xs leading-none text-muted-foreground">{userEmail}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem render={<Link href="/settings" />}>
                <SettingsIcon />
                个人设置
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={async () => {
                  await signOut({ redirect: false });
                  window.location.href = "/login";
                }}
              >
                <LogOutIcon />
                退出登录
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              className="md:hidden"
              render={<Button variant="ghost" size="sm" />}
            >
              菜单
            </SheetTrigger>
            <SheetContent side="top" className="pt-10">
              <SheetTitle className="sr-only">导航菜单</SheetTitle>
              <nav className="flex flex-col gap-1">
                <NavLinks items={visibleItems} pathname={pathname} mobile onClose={() => setOpen(false)} />
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 3: 验证构建**

Run: `npx next build 2>&1 | tail -20`
Expected: 构建成功，无类型错误

- [ ] **Step 4: Commit**

```bash
git add src/app/(main)/layout.tsx src/components/navbar.tsx
git commit -m "feat(navbar): replace settings nav link with avatar dropdown menu"
```

---

### Task 5: 手动验证

- [ ] **Step 1: 启动开发服务器**

Run: `npm run dev -- --hostname 0.0.0.0`

- [ ] **Step 2: 验证导航栏**

在浏览器中检查：
- 左侧导航不再显示"设置"链接
- 右上角显示用户名首字母圆形头像
- 点击头像弹出下拉菜单，显示用户名、邮箱、"个人设置"链接、"退出登录"按钮
- 点击"个人设置"跳转到 `/settings`
- 点击"退出登录"正常退出

- [ ] **Step 3: 验证设置页面**

在 `/settings` 页面检查：
- 显示两个上下堆叠的卡片：修改姓名、修改密码
- 修改姓名输入框默认显示当前姓名
- 修改姓名后提交成功，导航栏右上角头像首字母更新
- 修改密码功能正常

- [ ] **Step 4: 验证移动端**

缩小浏览器窗口检查：
- 汉堡菜单正常工作
- 头像下拉菜单在移动端正常显示
