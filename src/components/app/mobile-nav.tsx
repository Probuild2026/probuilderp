"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { navGroups } from "@/components/app/sidebar";

export function MobileNav() {
  const pathname = usePathname();

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          Menu
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-80 border-white/60 bg-sidebar/92 p-0 backdrop-blur-2xl">
        <SheetHeader className="border-b border-sidebar-border p-4">
          <SheetTitle>Probuild ERP</SheetTitle>
        </SheetHeader>
        <nav className="space-y-4 p-2">
          {navGroups.map((group) => (
            <div key={group.header}>
              <div className="px-3 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground/80">{group.header}</div>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const active = pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-all duration-200",
                        active
                          ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-[0_18px_30px_-24px_color-mix(in_srgb,var(--sidebar-primary)_80%,transparent)]"
                          : "text-muted-foreground hover:bg-white/72 hover:text-accent-foreground",
                      )}
                    >
                      <Icon className="size-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
