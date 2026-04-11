import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function DetailWorkspaceHeader({
  eyebrow,
  title,
  description,
  actions,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[28px] border border-border/70 bg-gradient-to-br from-background via-background to-muted/35">
      <div className="flex flex-col gap-5 border-b border-border/60 px-5 py-5 md:px-7 md:py-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 space-y-2">
            {eyebrow ? (
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {eyebrow}
              </div>
            ) : null}
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
              {description ? <div className="max-w-3xl text-sm text-muted-foreground">{description}</div> : null}
            </div>
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      </div>
      {children ? <div className="px-5 py-5 md:px-7 md:py-6">{children}</div> : null}
    </section>
  );
}

export function DetailWorkspacePanel({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-[24px] border border-border/70 bg-background shadow-sm", className)}>
      <div className="flex flex-col gap-4 border-b border-border/60 px-5 py-5 md:flex-row md:items-start md:justify-between md:px-6">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          {description ? <div className="text-sm text-muted-foreground">{description}</div> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      <div className="px-5 py-5 md:px-6 md:py-6">{children}</div>
    </section>
  );
}

export function DetailWorkspaceStats({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("grid gap-3 sm:grid-cols-2 xl:grid-cols-4", className)}>{children}</div>;
}

export function DetailWorkspaceStat({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-2xl border border-border/60 bg-background/80 p-4", className)}>
      <div className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className="mt-3 text-2xl font-semibold tracking-tight">{value}</div>
      {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}
