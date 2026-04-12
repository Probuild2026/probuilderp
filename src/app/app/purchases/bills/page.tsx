import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { Prisma } from "@prisma/client";
import { AlertTriangle, CheckCircle2, FileClock, Landmark } from "lucide-react";

import { ApprovalStatusBadge } from "@/components/app/approval-status-badge";
import { ApprovalStatusGuide } from "@/components/app/approval-status-guide";
import { ExportLinks } from "@/components/app/export-links";
import { PageHeader } from "@/components/app/page-header";
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

type BillsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function BillsPage({ searchParams }: BillsPageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const sp = (await searchParams) ?? {};
  const q = getSingleSearchParam(sp, "q");
  const approval = parseApprovalStatus(getSingleSearchParam(sp, "approval"));
  const { from, to } = parseDateRangeParams(sp);
  const dateRange = buildInclusiveDateRange(from, to);

  const projectId = await getSelectedProjectId();
  const where: Prisma.PurchaseInvoiceWhereInput = {
    tenantId: session.user.tenantId,
    ...(projectId ? { projectId } : {}),
    ...(approval ? { approvalStatus: approval } : {}),
  };

  if (q) {
    where.OR = [
      { invoiceNumber: { contains: q, mode: "insensitive" } },
      { vendor: { name: { contains: q, mode: "insensitive" } } },
      { project: { name: { contains: q, mode: "insensitive" } } },
    ];
  }
  if (from || to) {
    where.invoiceDate = dateRange;
  }

  const bills = await prisma.purchaseInvoice.findMany({
    where,
    orderBy: [{ invoiceDate: "desc" }, { createdAt: "desc" }],
    take: 200,
    select: {
      id: true,
      invoiceNumber: true,
      invoiceDate: true,
      total: true,
      taxableValue: true,
      approvalStatus: true,
      vendor: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
    },
  });

  const paid = bills.length
    ? await prisma.transactionAllocation.groupBy({
        by: ["documentId"],
        where: {
          tenantId: session.user.tenantId,
          documentType: "PURCHASE_INVOICE",
          documentId: { in: bills.map((b) => b.id) },
        },
        _sum: { grossAmount: true },
      })
    : [];

  const paidById = new Map(paid.map((p) => [p.documentId, Number(p._sum.grossAmount ?? 0)]));

  const totals = bills.reduce(
    (acc, bill) => {
      const total = Number(bill.total);
      const paidGross = paidById.get(bill.id) ?? 0;
      const balance = Math.max(0, total - paidGross);
      acc.total += total;
      acc.paid += paidGross;
      acc.balance += balance;
      if (balance > 1) acc.openCount += 1;
      if (bill.approvalStatus === "PENDING_APPROVAL") acc.pendingApproval += 1;
      if (paidGross >= total && total > 0) acc.closedCount += 1;
      return acc;
    },
    { total: 0, paid: 0, balance: 0, openCount: 0, pendingApproval: 0, closedCount: 0 },
  );

  return (
    <div className="mx-auto max-w-[1440px] space-y-6 p-4 md:p-6">
      <PageHeader
        eyebrow="Purchases / Bills"
        title="Vendor bills"
        description="Review payable exposure, outstanding settlement load, and approval state before dropping into the bill register."
        action={{ label: "New bill", href: "/app/purchases/bills/new" }}
        actions={<ExportLinks hrefBase="/api/exports/bills" params={{ q, from, to, approval }} />}
        actionSecondary={<EntryRoutingHelpModal />}
      />

      <ModuleCheatSheet moduleKey="bills" variant="compact" />

      <section className="grid gap-4 xl:grid-cols-[1.25fr_1fr]">
        <Card>
          <CardHeader className="border-b border-border/60">
            <CardTitle className="text-base">Payables summary</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 pt-6 sm:grid-cols-2 2xl:grid-cols-4">
            <SummaryTile icon={Landmark} label="Bill value" value={formatINR(totals.total)} />
            <SummaryTile icon={CheckCircle2} label="Already settled" value={formatINR(totals.paid)} />
            <SummaryTile icon={AlertTriangle} label="Outstanding" value={formatINR(totals.balance)} emphasis />
            <SummaryTile icon={FileClock} label="Open bills" value={String(totals.openCount)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border/60">
            <CardTitle className="text-base">Workload</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-6">
            <QueuePill label="Pending approval" value={String(totals.pendingApproval)} />
            <QueuePill label="Fully closed bills" value={String(totals.closedCount)} />
            <QueuePill label="Bills in current view" value={String(bills.length)} />
          </CardContent>
        </Card>
      </section>

      <form className="grid gap-3 rounded-[24px] border border-border/70 bg-card px-4 py-4 md:grid-cols-[1fr_auto_auto_auto_auto]" method="get">
        <Input name="q" defaultValue={q} placeholder="Search bill #, vendor, project…" className="md:max-w-xl" />
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
            <Link href="/app/purchases/bills">Reset</Link>
          </Button>
        </div>
      </form>

      <ApprovalStatusGuide />

      <Card>
        <CardHeader className="border-b border-border/60">
          <CardTitle className="text-base">Bill register</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table className="min-w-[980px]">
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Bill</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead className="hidden lg:table-cell">Project</TableHead>
                <TableHead className="hidden md:table-cell">Review</TableHead>
                <TableHead className="text-right">Taxable</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead className="text-right">Open</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bills.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="py-12 text-center text-sm text-muted-foreground">
                    No bills matched this view.
                  </TableCell>
                </TableRow>
              ) : (
                bills.map((bill) => {
                  const total = Number(bill.total);
                  const paidGross = paidById.get(bill.id) ?? 0;
                  const balance = Math.max(0, total - paidGross);

                  return (
                    <TableRow key={bill.id}>
                      <TableCell>{bill.invoiceDate.toISOString().slice(0, 10)}</TableCell>
                      <TableCell className="min-w-0">
                        <div className="min-w-0">
                          <Link className="block truncate font-semibold hover:underline" href={`/app/purchases/bills/${bill.id}`}>
                            {bill.invoiceNumber}
                          </Link>
                          <div className="mt-1 truncate text-xs text-muted-foreground lg:hidden">
                            {bill.vendor.name} • {bill.project.name}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[260px] truncate">{bill.vendor.name}</TableCell>
                      <TableCell className="hidden lg:table-cell max-w-[260px] truncate">{bill.project.name}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        <ApprovalStatusBadge status={bill.approvalStatus} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatINR(Number(bill.taxableValue))}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatINR(total)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatINR(paidGross)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatINR(balance)}</TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant={balance > 1 ? "secondary" : "outline"}>
                          <Link href={`/app/purchases/bills/${bill.id}`}>{balance > 1 ? "Review" : "View"}</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
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
