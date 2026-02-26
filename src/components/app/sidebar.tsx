import Link from "next/link";

import { cn } from "@/lib/utils";

export const appNav = [
  { href: "/app", label: "Dashboard" },
  { href: "/app/clients", label: "Clients" },
  { href: "/app/vendors", label: "Vendors" },
  { href: "/app/projects", label: "Projects" },
  { href: "/app/items", label: "Items" },
  { href: "/app/inventory", label: "Inventory" },
  { href: "/app/expenses", label: "Expenses" },
  { href: "/app/reports/monthly-expenses", label: "Monthly CSV" },
  { href: "/app/settings/account", label: "Account" },
];

export function Sidebar({ className }: { className?: string }) {
  return (
    <aside className={cn("w-64 border-r bg-background p-4", className)}>
      <div className="text-lg font-semibold">Probuild ERP</div>
      <nav className="mt-6 space-y-1">
        {appNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="block rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
