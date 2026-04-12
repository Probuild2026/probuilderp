import { AlertTriangle, DatabaseZap, Inbox } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { TableCell, TableRow } from "@/components/ui/table";

export function StatePanel({
  title,
  description,
  tone = "neutral",
}: {
  title: string;
  description: string;
  tone?: "neutral" | "warning";
}) {
  const Icon = tone === "warning" ? DatabaseZap : AlertTriangle;

  return (
    <Card className={tone === "warning" ? "border-[color:var(--warning)]/30 bg-[color:var(--warning)]/7" : ""}>
      <CardContent className="flex items-start gap-3 px-4 py-4">
        <div
          className={`mt-0.5 rounded-full p-2 ${
            tone === "warning" ? "bg-[color:var(--warning)]/14 text-[color:var(--warning)]" : "bg-muted text-muted-foreground"
          }`}
        >
          <Icon className="size-4" />
        </div>
        <div className="space-y-1">
          <div className="font-medium">{title}</div>
          <div className="text-sm text-muted-foreground">{description}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export function InlineEmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-[20px] border border-dashed border-border/80 bg-background/60 px-4 py-8 text-center">
      <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Inbox className="size-4" />
      </div>
      <div className="mt-3 text-sm font-medium">{title}</div>
      <div className="mt-1 text-sm text-muted-foreground">{description}</div>
    </div>
  );
}

export function TableEmptyState({
  colSpan,
  title,
  description,
}: {
  colSpan: number;
  title: string;
  description: string;
}) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="py-10">
        <div className="mx-auto max-w-md text-center">
          <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Inbox className="size-4" />
          </div>
          <div className="mt-3 text-sm font-medium">{title}</div>
          <div className="mt-1 text-sm text-muted-foreground">{description}</div>
        </div>
      </TableCell>
    </TableRow>
  );
}
