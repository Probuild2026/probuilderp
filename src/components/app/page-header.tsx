import Link from "next/link";

import { Button } from "@/components/ui/button";

export function PageHeader({
  title,
  description,
  action,
  actionSecondary,
  actions,
  filters,
  eyebrow,
}: {
  title: string;
  description?: string;
  action?: { label: string; href: string };
  actionSecondary?: React.ReactNode;
  actions?: React.ReactNode;
  filters?: React.ReactNode;
  eyebrow?: string;
}) {
  return (
    <section className="rounded-[28px] border border-border/70 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--card)_92%,transparent),color-mix(in_srgb,var(--surface-muted)_55%,transparent))] px-5 py-5 shadow-[0_28px_80px_-64px_rgba(44,34,20,0.7)] md:px-6 md:py-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          {eyebrow ? (
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{eyebrow}</div>
          ) : null}
          <h1 className="truncate text-2xl font-semibold tracking-tight md:text-[2rem]">{title}</h1>
          {description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p> : null}
          {filters ? <div className="mt-4">{filters}</div> : null}
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          {actions}
          {actionSecondary}
          {action ? (
            <Button asChild>
              <Link href={action.href}>{action.label}</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
