import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { CircleDollarSign, FileSpreadsheet, HandCoins, Landmark } from "lucide-react";

import { ExportLinks } from "@/components/app/export-links";
import { PageHeader } from "@/components/app/page-header";
import { TableEmptyState } from "@/components/app/state-panels";
import { EntryRoutingHelpModal } from "@/components/help/entry-routing-help-modal";
import { ModuleCheatSheet } from "@/components/help/module-cheat-sheet";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { buildInclusiveDateRange, parseDateRangeParams } from "@/lib/date-range";
import { formatINR } from "@/lib/money";
import { getSelectedProjectId } from "@/lib/project-filter";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

function statusFromSettled(total: number, settled: number) {
  if (settled >= total) return "PAID";
  if (settled > 0) return "PARTIAL";
  return "DUE";
}

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const sp = (await searchParams) ?? {};
  const { from, to } = parseDateRangeParams(sp);
  const dateRange = buildInclusiveDateRange(from, to);
  const projectId = await getSelectedProjectId();

  const invoices = await prisma.clientInvoice.findMany({
    where: {
      tenantId: session.user.tenantId,
      ...(projectId ? { projectId } : {}),
      ...(dateRange ? { invoiceDate: dateRange } : {}),
    },
    orderBy: [{ invoiceDate: "desc" }, { createdAt: "desc" }],
    take: 200,
    select: {
      id: true,
      invoiceNumber: true,
      invoiceDate: true,
      total: true,
      basicValue: true,
      project: { select: { name: true } },
      client: { select: { name: true } },
    },
  });

  const invoiceIds = invoices.map((invoice) => invoice.id);
  const allocations =
    invoiceIds.length === 0
      ? []
      : await prisma.transactionAllocation.groupBy({
          by: ["documentId"],
          where: {
            tenantId: session.user.tenantId,
            documentType: "CLIENT_INVOICE",
            documentId: { in: invoiceIds },
          },
          _sum: { cashAmount: true, tdsAmount: true, grossAmount: true },
        });

  const byInvoiceId = new Map(
    allocations.map((allocation) => [
      allocation.documentId,
      {
        cash: Number(allocation._sum.cashAmount ?? 0),
        tds: Number(allocation._sum.tdsAmount ?? 0),
        gross: Number(allocation._sum.grossAmount ?? 0),
      },
    ]),
  );

  const totals = invoices.reduce(
    (acc, invoice) => {
      const settled = byInvoiceId.get(invoice.id) ?? { cash: 0, tds: 0, gross: 0 };
      const total = Number(invoice.total);
      const outstanding = Math.max(0, total - settled.gross);
      acc.billed += total;
      acc.cash += settled.cash;
      acc.tds += settled.tds;
      acc.outstanding += outstanding;
      if (outstanding > 1) acc.openCount += 1;
      return acc;
    },
    { billed: 0, cash: 0, tds: 0, outstanding: 0, openCount: 0 },
  );

  return (
    <div className="w-full space-y-6 p-4 md:p-6">
      <PageHeader
        eyebrow="Sales / Invoices"
        title="Invoices"
        description="Track billed value, settled receipts, TDS impact, and remaining collection pressure before opening individual invoice workspaces."
        action={{ label: "New invoice", href: "/app/sales/invoices/new" }}
        actions={<ExportLinks hrefBase="/api/exports/invoices" params={{ from, to }} />}
        actionSecondary={<EntryRoutingHelpModal />}
      />

      <ModuleCheatSheet moduleKey="invoices" variant="compact" />

      <section className="rounded-[26px] border border-border/70 bg-card px-5 py-4 shadow-[0_18px_40px_-34px_rgba(91,124,191,0.16)]">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <MetricInline label="Billed" value={formatINR(totals.billed)} accent="text-foreground" />
          <MetricInline label="Cash" value={formatINR(totals.cash)} accent="text-[var(--color-info)]" />
          <MetricInline label="TDS" value={formatINR(totals.tds)} accent="text-[var(--color-success)]" />
          <MetricInline label="Outstanding" value={formatINR(totals.outstanding)} accent="text-[var(--color-warning)]" />
          <MetricInline label="Open invoices" value={String(totals.openCount)} accent="text-primary" />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader className="border-b border-border/60">
            <CardTitle className="text-base">Collections summary</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 pt-6 sm:grid-cols-2 2xl:grid-cols-4">
            <SummaryTile icon={FileSpreadsheet} label="Billed value" value={formatINR(totals.billed)} />
            <SummaryTile icon={HandCoins} label="Cash received" value={formatINR(totals.cash)} />
            <SummaryTile icon={Landmark} label="TDS settled" value={formatINR(totals.tds)} />
            <SummaryTile icon={CircleDollarSign} label="Outstanding" value={formatINR(totals.outstanding)} emphasis />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border/60">
            <CardTitle className="text-base">Work queue</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-6">
            <QueuePill label="Invoices in current view" value={String(invoices.length)} />
            <QueuePill label="Still awaiting collection" value={String(totals.openCount)} />
            <QueuePill label="Exports ready" value="CSV / Excel / PDF" />
          </CardContent>
        </Card>
      </section>

      <form className="grid gap-3 rounded-[28px] border border-border/70 bg-gradient-to-br from-[rgba(225,236,255,0.32)] via-white to-[rgba(255,244,219,0.18)] px-4 py-4 shadow-[0_18px_40px_-34px_rgba(91,124,191,0.14)] md:grid-cols-[auto_auto_auto]" method="get">
        <Input name="from" type="date" defaultValue={from} />
        <Input name="to" type="date" defaultValue={to} />
        <div className="flex gap-2">
          <Button type="submit">Apply</Button>
          <Button asChild variant="outline">
            <Link href="/app/sales/invoices">Reset</Link>
          </Button>
        </div>
      </form>

      <Card>
        <CardHeader className="border-b border-border/60">
          <CardTitle className="text-base">Invoice ledger</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
          <Table className="min-w-[1180px]">
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Invoice #</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Client</TableHead>
                <TableHead className="text-right">Basic</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Received</TableHead>
                <TableHead className="text-right">TDS</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Open</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.length === 0 ? (
                <TableEmptyState
                  colSpan={11}
                  title="No invoices matched this view"
                  description="Try widening the date range or switching to a broader project context."
                />
              ) : (
                invoices.map((invoice) => {
                  const allocation = byInvoiceId.get(invoice.id) ?? { cash: 0, tds: 0, gross: 0 };
                  const total = Number(invoice.total);
                  const outstanding = Math.max(0, total - allocation.gross);
                  const status = statusFromSettled(total, allocation.gross);

                  return (
                    <TableRow key={invoice.id}>
                      <TableCell>{invoice.invoiceDate.toISOString().slice(0, 10)}</TableCell>
                      <TableCell className="font-semibold">{invoice.invoiceNumber}</TableCell>
                      <TableCell className="max-w-[220px] truncate">{invoice.project.name}</TableCell>
                      <TableCell className="max-w-[220px] truncate">{invoice.client.name}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatINR(Number(invoice.basicValue))}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatINR(total)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatINR(allocation.cash)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatINR(allocation.tds)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatINR(outstanding)}</TableCell>
                      <TableCell>{status}</TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant={outstanding > 1 ? "secondary" : "outline"}>
                          <Link href={`/app/sales/invoices/${invoice.id}`}>{outstanding > 1 ? "Review" : "View"}</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryTile({
  icon: Icon,
  label,
  value,
  emphasis = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className={`min-w-0 rounded-[22px] border border-border/60 px-4 py-4 shadow-[0_12px_28px_-28px_rgba(91,124,191,0.2)] ${emphasis ? "bg-accent/55" : "bg-white/82"}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <div className="mt-4 min-w-0 text-xl font-semibold leading-tight tracking-tight [overflow-wrap:anywhere] sm:text-2xl">
        {value}
      </div>
    </div>
  );
}

function QueuePill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[18px] border border-border/60 bg-white/84 px-4 py-3 shadow-[0_12px_24px_-28px_rgba(91,124,191,0.2)]">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}

function MetricInline({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className={`text-2xl font-semibold tracking-tight ${accent ?? "text-foreground"}`}>{value}</div>
    </div>
  );
}
