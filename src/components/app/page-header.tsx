import Link from "next/link";

import { Button } from "@/components/ui/button";

export function PageHeader({
  title,
  description,
  action,
  actions,
  filters,
}: {
  title: string;
  description?: string;
  action?: { label: string; href: string };
  actions?: React.ReactNode;
  filters?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-semibold">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        {filters ? <div className="mt-3">{filters}</div> : null}
      </div>

      <div className="flex shrink-0 flex-wrap gap-2">
        {actions}
        {action ? (
          <Button asChild>
            <Link href={action.href}>{action.label}</Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
