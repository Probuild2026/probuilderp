import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { BadgeIndianRupee, FileCheck2, HandCoins, ShieldCheck } from "lucide-react";

import { ApprovalStatusBadge } from "@/components/app/approval-status-badge";
import { ApprovalStatusGuide } from "@/components/app/approval-status-guide";
import { ExportLinks } from "@/components/app/export-links";
import { PageHeader } from "@/components/app/page-header";
import { TableEmptyState } from "@/components/app/state-panels";
import { EntryRoutingHelpModal } from "@/components/help/entry-routing-help-modal";
import { ModuleCheatSheet } from "@/components/help/module-cheat-sheet";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { approvalStatusLabels, approvalStatusValues, parseApprovalStatus } from "@/lib/approval-status";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { buildInclusiveDateRange, getSingleSearchParam, parseDateRangeParams } from "@/lib/date-range";
import { formatINR } from "@/lib/money";
import { getSelectedProjectId } from "@/lib/project-filter";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

import { deleteReceipt } from "./actions";

export default async function ReceiptsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const sp = (await searchParams) ?? {};
  const approval = parseApprovalStatus(getSingleSearchParam(sp, "approval"));
  const { from, to } = parseDateRangeParams(sp);
  const dateRange = buildInclusiveDateRange(from, to);
  const projectId = await getSelectedProjectId();

  const receipts = await prisma.receipt.findMany({
    where: {
      tenantId: session.user.tenantId,
      ...(projectId ? { clientInvoice: { projectId } } : {}),
      ...(dateRange ? { date: dateRange } : {}),
      ...(approval ? { approvalStatus: approval } : {}),
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 200,
    select: {
      id: true,
      date: true,
      amountReceived: true,
      mode: true,
      tdsAmount: true,
      approvalStatus: true,
      clientInvoice: {
        select: {
          id: true,
          invoiceNumber: true,
          project: { select: { name: true } },
          client: { select: { name: true } },
        },
      },
    },
  });

  const totals = receipts.reduce(
    (acc, receipt) => {
      acc.cash += Number(receipt.amountReceived);
      acc.tds += Number(receipt.tdsAmount ?? 0);
      acc.count += 1;
      if (receipt.approvalStatus === "PENDING_APPROVAL") acc.pendingApproval += 1;
      return acc;
    },
    { cash: 0, tds: 0, count: 0, pendingApproval: 0 },
  );

  return (
    <div className="mx-auto max-w-[1440px] space-y-6 p-4 md:p-6">
      <PageHeader
        eyebrow="Sales / Receipts"
        title="Receipts"
        description="Review incoming cash, TDS deductions, and approval state across posted receipts before opening invoice-level settlement detail."
        action={{ label: "New receipt", href: "/app/sales/receipts/new" }}
        actions={
          <>
            <ExportLinks hrefBase="/api/exports/receipts" params={{ from, to, approval }} />
            <Button asChild variant="outline">
              <Link href="/app/sales/invoices">Go to invoices</Link>
            </Button>
          </>
        }
        actionSecondary={<EntryRoutingHelpModal />}
      />

      <ModuleCheatSheet moduleKey="receipts" variant="compact" />

      <section className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader className="border-b border-border/60">
            <CardTitle className="text-base">Receipt summary</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 pt-6 sm:grid-cols-2 2xl:grid-cols-4">
            <SummaryTile icon={HandCoins} label="Cash received" value={formatINR(totals.cash)} />
            <SummaryTile icon={ShieldCheck} label="TDS received" value={formatINR(totals.tds)} />
            <SummaryTile icon={BadgeIndianRupee} label="Gross settlement" value={formatINR(totals.cash + totals.tds)} emphasis />
            <SummaryTile icon={FileCheck2} label="Receipt count" value={String(totals.count)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border/60">
            <CardTitle className="text-base">Control checks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-6">
            <QueuePill label="Pending approval" value={String(totals.pendingApproval)} />
            <QueuePill label="Receipts in current view" value={String(receipts.length)} />
            <QueuePill label="Exports ready" value="CSV / Excel / PDF" />
          </CardContent>
        </Card>
      </section>

      <form className="grid gap-3 rounded-[24px] border border-border/70 bg-card px-4 py-4 md:grid-cols-[auto_auto_auto_auto]" method="get">
        <select
          name="approval"
          defaultValue={approval ?? ""}
          className="h-10 rounded-xl border border-border/80 bg-background/80 px-3 text-sm shadow-sm"
        >
          <option value="">All review statuses</option>
          {approvalStatusValues.map((status) => (
            <option key={status} value={status}>
              {approvalStatusLabels[status]}
            </option>
          ))}
        </select>
        <Input name="from" type="date" defaultValue={from} />
        <Input name="to" type="date" defaultValue={to} />
        <div className="flex gap-2">
          <Button type="submit">Apply</Button>
          <Button asChild variant="outline">
            <Link href="/app/sales/receipts">Reset</Link>
          </Button>
        </div>
      </form>

      <ApprovalStatusGuide />

      <Card>
        <CardHeader className="border-b border-border/60">
          <CardTitle className="text-base">Receipt ledger</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Invoice #</TableHead>
                <TableHead className="hidden md:table-cell">Project</TableHead>
                <TableHead className="hidden md:table-cell">Client</TableHead>
                <TableHead className="text-right">Received</TableHead>
                <TableHead className="text-right">TDS</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead className="hidden md:table-cell">Review</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {receipts.length === 0 ? (
                <TableEmptyState
                  colSpan={9}
                  title="No receipts matched this view"
                  description="Try clearing the approval filter or expanding the date range."
                />
              ) : (
                receipts.map((receipt) => (
                  <TableRow key={receipt.id}>
                    <TableCell>{receipt.date.toISOString().slice(0, 10)}</TableCell>
                    <TableCell className="font-semibold">
                      <Link className="hover:underline" href={`/app/sales/receipts/${receipt.id}`}>
                        {receipt.clientInvoice.invoiceNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden max-w-[220px] truncate md:table-cell">{receipt.clientInvoice.project.name}</TableCell>
                    <TableCell className="hidden max-w-[220px] truncate md:table-cell">{receipt.clientInvoice.client.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatINR(Number(receipt.amountReceived))}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatINR(Number(receipt.tdsAmount ?? 0))}</TableCell>
                    <TableCell>{receipt.mode}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      <ApprovalStatusBadge status={receipt.approvalStatus} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button asChild size="sm" variant="secondary">
                          <Link href={`/app/sales/receipts/${receipt.id}`}>View</Link>
                        </Button>
                        <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
                          <Link href={`/app/sales/invoices/${receipt.clientInvoice.id}`}>Invoice</Link>
                        </Button>
                        <form
                          action={async () => {
                            "use server";
                            await deleteReceipt(receipt.id, receipt.clientInvoice.id);
                          }}
                        >
                          <Button variant="destructive" size="sm" type="submit">
                            Delete
                          </Button>
                        </form>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
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
    <div className={`min-w-0 rounded-[22px] border border-border/60 px-4 py-4 ${emphasis ? "bg-accent/50" : "bg-background/70"}`}>
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
    <div className="flex items-center justify-between gap-3 rounded-[18px] border border-border/60 bg-background/70 px-4 py-3">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}
