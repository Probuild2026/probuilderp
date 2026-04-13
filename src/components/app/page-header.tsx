import Link from "next/link";

import { Button } from "@/components/ui/button";

function resolveHeaderTone(title: string, eyebrow?: string) {
  const key = `${eyebrow ?? ""} ${title}`.toLowerCase();

  if (key.includes("sales") || key.includes("invoice") || key.includes("receipt") || key.includes("client")) {
    return "from-[rgba(255,186,147,0.5)] via-[rgba(245,233,255,0.55)] to-[rgba(183,213,255,0.45)]";
  }
  if (key.includes("purchase") || key.includes("vendor") || key.includes("inventory")) {
    return "from-[rgba(173,210,255,0.42)] via-[rgba(236,244,255,0.7)] to-[rgba(255,241,201,0.45)]";
  }
  if (key.includes("workforce") || key.includes("wage") || key.includes("partner")) {
    return "from-[rgba(191,239,220,0.5)] via-[rgba(243,251,247,0.76)] to-[rgba(199,227,255,0.4)]";
  }
  if (key.includes("report") || key.includes("finance") || key.includes("transaction") || key.includes("expense")) {
    return "from-[rgba(210,228,255,0.56)] via-[rgba(247,250,255,0.78)] to-[rgba(255,239,208,0.42)]";
  }
  if (key.includes("project") || key.includes("dashboard") || key.includes("overview")) {
    return "from-[rgba(225,235,255,0.6)] via-[rgba(248,250,255,0.82)] to-[rgba(232,243,255,0.45)]";
  }

  return "from-[rgba(232,239,255,0.52)] via-[rgba(249,251,255,0.82)] to-[rgba(238,245,255,0.42)]";
}

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
  const tone = resolveHeaderTone(title, eyebrow);

  return (
    <section
      className={`rounded-[28px] border border-border/70 bg-gradient-to-br ${tone} px-5 py-5 shadow-[0_28px_80px_-64px_rgba(91,124,191,0.22)] md:px-6 md:py-6`}
    >
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
