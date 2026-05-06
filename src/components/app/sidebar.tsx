"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import {
  ArrowLeftRight,
  BarChart3,
  BellRing,
  Briefcase,
  Boxes,
  Building2,
  ClipboardList,
  FileSpreadsheet,
  FileText,
  HandCoins,
  LayoutDashboard,
  Package,
  PackageCheck,
  Receipt,
  Settings2,
  Upload,
  UsersRound,
  Wallet,
  Truck,
  Users,
  UserRoundCog,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const navGroups = [
  {
    header: "Overview",
    items: [
      { href: "/app", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    header: "Projects",
    items: [
      { href: "/app/projects", label: "Projects", icon: Building2 },
      { href: "/app/inventory", label: "Inventory", icon: Boxes },
    ],
  },
  {
    header: "Purchases",
    items: [
      { href: "/app/purchases/materials", label: "Materials", icon: PackageCheck },
      { href: "/app/purchases/bills", label: "Bills", icon: FileText },
      { href: "/app/purchases/payments-made", label: "Payments Made", icon: Wallet },
      { href: "/app/vendors", label: "Vendors", icon: Truck },
    ],
  },
  {
    header: "Sales",
    items: [
      { href: "/app/sales/invoices", label: "Invoices", icon: FileSpreadsheet },
      { href: "/app/sales/receipts", label: "Receipts", icon: HandCoins },
      { href: "/app/clients", label: "Clients", icon: Users },
    ],
  },
  {
    header: "Workforce",
    items: [
      { href: "/app/wages", label: "Wages", icon: Briefcase },
      { href: "/app/partners", label: "Partners", icon: UserRoundCog },
    ],
  },
  {
    header: "Finance",
    items: [
      { href: "/app/expenses", label: "Expenses", icon: ClipboardList },
      { href: "/app/transactions", label: "Transactions", icon: ArrowLeftRight },
      { href: "/app/reports", label: "Reports", icon: BarChart3 },
      { href: "/app/reports/monthly-expenses", label: "Monthly Outflows", icon: Receipt },
    ],
  },
  {
    header: "Admin",
    items: [
      { href: "/app/imports", label: "Imports", icon: Upload },
      { href: "/app/items", label: "Items", icon: Package },
      { href: "/app/settings/business", label: "Business", icon: Settings2 },
      { href: "/app/settings/account", label: "Account", icon: UsersRound },
    ],
  },
] as const;

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
        "sticky top-0 h-screen overflow-y-auto border-r border-sidebar-border bg-sidebar p-3 shadow-[18px_0_48px_-42px_rgba(91,124,191,0.12)] backdrop-blur-xl transition-[width] duration-200",
        collapsed ? "w-20" : "w-72",
        className,
      )}
    >
      <div className={cn("flex items-center gap-2 px-2", collapsed ? "justify-center" : "justify-between")}>
        <div className={cn("min-w-0", collapsed && "sr-only")}>
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sidebar-foreground/55">Probuild</div>
          <div className="truncate text-base font-semibold text-sidebar-foreground">Construction OS</div>
        </div>
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

      <div
        className={cn(
          "mt-4 rounded-[24px] border border-border/70 bg-[linear-gradient(180deg,#ffffff,#f5f8fd)] px-3 py-3 shadow-[0_16px_32px_-30px_rgba(91,124,191,0.16)]",
          collapsed && "px-2",
        )}
      >
        {collapsed ? (
          <BellRing className="mx-auto size-4 text-sidebar-foreground/70" />
        ) : (
          <>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sidebar-foreground/55">Today</div>
            <div className="mt-2 text-sm text-sidebar-foreground">Review receivables, clear payables, and keep site cash visible.</div>
          </>
        )}
      </div>

      <nav className={cn("mt-4 space-y-4", collapsed ? "px-1" : "px-2")}>
        {navGroups.map((group) => (
          <div key={group.header}>
            <div
              className={cn(
                "px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/50",
                collapsed && "sr-only",
              )}
            >
              {group.header}
            </div>
            <div className="space-y-1">
              {group.items.map((item) => {
                const active = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-all duration-200",
                      active
                        ? "bg-accent text-accent-foreground shadow-[inset_0_0_0_1px_rgba(88,126,201,0.1)]"
                        : "text-sidebar-foreground/72 hover:bg-accent/70 hover:text-sidebar-accent-foreground",
                      collapsed && "justify-center px-2",
                    )}
                  >
                    <Icon className="size-4" />
                    <span className={cn(collapsed && "hidden")}>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
