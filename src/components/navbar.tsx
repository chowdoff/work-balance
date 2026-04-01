"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
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
  role,
}: {
  userName: string;
  role: UserRole;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const visibleItems = navItems.filter((item) => item.roles.includes(role));

  return (
    <header className="border-b bg-white">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <span className="text-lg font-bold">考勤系统</span>
          <nav className="hidden md:flex items-center gap-4">
            <NavLinks items={visibleItems} pathname={pathname} />
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
