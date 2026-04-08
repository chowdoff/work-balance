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
  DropdownMenuGroup,
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
  { label: "审批管理", href: "/approval", roles: ["admin", "manager", "employee"] },
  { label: "统计报表", href: "/statistics", roles: ["admin", "manager"] },
  { label: "组织管理", href: "/organization", roles: ["admin"] },
  { label: "工作年度", href: "/work-year", roles: ["admin"] },
];

function NavLinks({
  items,
  pathname,
  mobile,
  onClose,
  pendingApprovalCount,
}: {
  items: NavItem[];
  pathname: string;
  mobile?: boolean;
  onClose?: () => void;
  pendingApprovalCount: number;
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
          {item.href === "/approval" && pendingApprovalCount > 0 && (
            <span className="ml-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
              {pendingApprovalCount}
            </span>
          )}
        </Link>
      ))}
    </>
  );
}

export function Navbar({
  userName,
  userEmail,
  role,
  pendingApprovalCount = 0,
}: {
  userName: string;
  userEmail: string;
  role: UserRole;
  pendingApprovalCount?: number;
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
            <img src="/logo.png" alt="Work Balance" className="h-7 w-7" />
            <span className="text-lg font-bold">Work Balance</span>
          </Link>
          <nav className="hidden md:flex items-center gap-4">
            <NavLinks items={visibleItems} pathname={pathname} pendingApprovalCount={pendingApprovalCount} />
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
              <DropdownMenuGroup>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-medium leading-none">{userName}</p>
                    <p className="text-xs leading-none text-muted-foreground">{userEmail}</p>
                  </div>
                </DropdownMenuLabel>
              </DropdownMenuGroup>
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
                <NavLinks items={visibleItems} pathname={pathname} mobile onClose={() => setOpen(false)} pendingApprovalCount={pendingApprovalCount} />
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
