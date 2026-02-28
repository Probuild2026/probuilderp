"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import {
  ArrowLeftRight,
  Boxes,
  Building2,
  ClipboardList,
  FileSpreadsheet,
  LayoutDashboard,
  Package,
  Settings,
  Truck,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const appNav = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard },
  { href: "/app/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/app/sales/invoices", label: "Invoices", icon: FileSpreadsheet },
  { href: "/app/sales/receipts", label: "Receipts", icon: FileSpreadsheet },
  { href: "/app/purchases/bills", label: "Bills", icon: FileSpreadsheet },
  { href: "/app/purchases/payments-made", label: "Payments Made", icon: FileSpreadsheet },
  { href: "/app/imports", label: "Import CSV", icon: FileSpreadsheet },
  { href: "/app/clients", label: "Clients", icon: Users },
  { href: "/app/vendors", label: "Vendors", icon: Truck },
  { href: "/app/projects", label: "Projects", icon: Building2 },
  { href: "/app/items", label: "Items", icon: Package },
  { href: "/app/inventory", label: "Inventory", icon: Boxes },
  { href: "/app/expenses", label: "Expenses", icon: ClipboardList },
  { href: "/app/reports/monthly-expenses", label: "Monthly CSV", icon: FileSpreadsheet },
  { href: "/app/wages", label: "Wages", icon: ClipboardList },
  { href: "/app/settings/business", label: "Business", icon: Building2 },
  { href: "/app/settings/account", label: "Account", icon: Settings },
];

const STORAGE_KEY = "probuild.sidebarCollapsed";

export function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });

  function toggle() {
    setCollapsed((c) => {
      const next = !c;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }

  return (
    <aside
      className={cn(
        "border-r bg-background p-2 transition-[width] duration-200",
        collapsed ? "w-16" : "w-64",
        className,
      )}
    >
      <div className={cn("flex items-center gap-2 px-2", collapsed ? "justify-center" : "justify-between")}>
        <div className={cn("text-lg font-semibold", collapsed && "sr-only")}>Probuild ERP</div>
        <Button
          type="button"
          variant="outline"
          size={collapsed ? "icon-sm" : "sm"}
          className={cn(!collapsed && "ml-auto")}
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <span className="text-xs">{collapsed ? ">" : "<"}</span>
        </Button>
      </div>

      <nav className={cn("mt-3 space-y-1", collapsed ? "px-1" : "px-2")}>
        {appNav.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm",
                active
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                collapsed && "justify-center px-2",
              )}
            >
              <Icon className="size-4" />
              <span className={cn(collapsed && "hidden")}>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
