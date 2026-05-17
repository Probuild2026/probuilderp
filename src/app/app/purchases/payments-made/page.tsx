import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { Prisma } from "@prisma/client";
import { BriefcaseBusiness, CircleDollarSign, FileSpreadsheet, ShieldCheck } from "lucide-react";

import { ApprovalStatusBadge } from "@/components/app/approval-status-badge";
import { ApprovalStatusGuide } from "@/components/app/approval-status-guide";
import { ExportLinks } from "@/components/app/export-links";
import { PageHeader } from "@/components/app/page-header";
import { StatePanel, TableEmptyState } from "@/components/app/state-panels";
import { EntryRoutingHelpModal } from "@/components/help/entry-routing-help-modal";
import { ModuleCheatSheet } from "@/components/help/module-cheat-sheet";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { approvalStatusLabels, approvalStatusValues, parseApprovalStatus } from "@/lib/approval-status";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { buildInclusiveDateRange, getSingleSearchParam, parseDateRangeParams } from "@/lib/date-range";
import { formatINR } from "@/lib/money";
import { getSelectedProjectId } from "@/lib/project-filter";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

type PaymentsMadePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PaymentsMadePage({ searchParams }: PaymentsMadePageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const sp = (await searchParams) ?? {};
  const q = getSingleSearchParam(sp, "q");
  const approval = parseApprovalStatus(getSingleSearchParam(sp, "approval"));
  const { from, to } = parseDateRangeParams(sp);
  const dateRange = buildInclusiveDateRange(from, to);
  const projectId = await getSelectedProjectId();

  let txns:
    | Array<{
        id: string;
        date: Date;
        amount: Prisma.Decimal;
        tdsAmount: Prisma.Decimal;
        mode: string | null;
        reference: string | null;
        tdsSection: string | null;
        tdsDepositStatus: "PENDING" | "DEPOSITED";
        tdsChallanNumber: string | null;
        tdsChallanDate: Date | null;
        approvalStatus: "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "CANCELLED";
        vendor: { id: string; name: string } | null;
        project: { id: string; name: string } | null;
      }>
    | null = null;
  let dbUnavailable = false;
  let allocationCountByTxnId: Map<string, number> = new Map();

  try {
    txns = await prisma.transaction.findMany({
      where: {
        tenantId: session.user.tenantId,
        type: "EXPENSE",
        vendorId: { not: null },
        ...(q
          ? {
              OR: [
                { vendor: { name: { contains: q, mode: "insensitive" } } },
                { reference: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
        ...(from || to ? { date: dateRange } : {}),
        ...(approval ? { approvalStatus: approval } : {}),
        ...(projectId ? { projectId } : {}),
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 200,
      select: {
        id: true,
        date: true,
        amount: true,
        tdsAmount: true,
        mode: true,
        reference: true,
        tdsSection: true,
        tdsDepositStatus: true,
        tdsChallanNumber: true,
        tdsChallanDate: true,
        approvalStatus: true,
        vendor: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
      },
    });

    const txnIds = txns.map((t) => t.id);
    if (txnIds.length > 0) {
      const allocs = await prisma.transactionAllocation.findMany({
        where: { tenantId: session.user.tenantId, transactionId: { in: txnIds } },
        select: { transactionId: true },
      });
      allocationCountByTxnId = new Map();
      for (const allocation of allocs) {
        allocationCountByTxnId.set(allocation.transactionId, (allocationCountByTxnId.get(allocation.transactionId) ?? 0) + 1);
      }
    }
  } catch (e) {
    if (
      (e instanceof Prisma.PrismaClientKnownRequestError && (e.code === "P2021" || e.code === "P2022" || e.code === "P1001")) ||
      (e instanceof Error && e.message.includes("Can't reach database server"))
    ) {
      txns = null;
      dbUnavailable =
        (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P1001") ||
        (e instanceof Error && e.message.includes("Can't reach database server"));
    } else {
      throw e;
    }
  }

  const totals = (txns ?? []).reduce(
    (acc, row) => {
      const cash = Number(row.amount);
      const tds = Number(row.tdsAmount ?? 0);
      acc.cash += cash;
      acc.tds += tds;
      acc.gross += cash + tds;
      if ((allocationCountByTxnId.get(row.id) ?? 0) > 0) acc.billLinked += 1;
      if (row.approvalStatus === "PENDING_APPROVAL") acc.pendingApproval += 1;
      if (tds > 0 && row.tdsDepositStatus !== "DEPOSITED") acc.pendingTdsChallans += 1;
      return acc;
    },
    { cash: 0, tds: 0, gross: 0, billLinked: 0, pendingApproval: 0, pendingTdsChallans: 0 },
  );

  return (
    <div className="w-full space-y-6 p-4 md:p-6">
      <PageHeader
        eyebrow="Purchases / Payments Made"
        title="Vendor payments"
        description="Track net cash out, TDS withheld, and how much of the payout ledger is tied back to actual vendor bills."
        action={{ label: "New payment", href: "/app/purchases/payments-made/new" }}
        actions={<ExportLinks hrefBase="/api/exports/payments-made" params={{ q, from, to, approval }} />}
        actionSecondary={<EntryRoutingHelpModal />}
      />

      <ModuleCheatSheet moduleKey="paymentsMade" variant="compact" />

      {txns === null ? (
        <StatePanel
          tone="warning"
          title={dbUnavailable ? "Database temporarily unreachable" : "Database update required"}
          description={
            dbUnavailable
              ? "The app could not connect to the database. Check DATABASE_URL or Prisma Postgres availability and refresh."
              : "This deployment is missing required database objects for vendor payments. Apply Prisma migrations, then refresh."
          }
        />
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader className="border-b border-border/60">
            <CardTitle className="text-base">Settlement summary</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 pt-6 sm:grid-cols-2 2xl:grid-cols-4">
            <SummaryTile icon={CircleDollarSign} label="Cash paid" value={formatINR(totals.cash)} />
            <SummaryTile icon={ShieldCheck} label="TDS withheld" value={formatINR(totals.tds)} />
            <SummaryTile icon={BriefcaseBusiness} label="Gross settlements" value={formatINR(totals.gross)} emphasis />
            <SummaryTile icon={FileSpreadsheet} label="Bill-linked payouts" value={String(totals.billLinked)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border/60">
            <CardTitle className="text-base">Control checks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-6">
            <QueuePill label="Pending approval" value={String(totals.pendingApproval)} />
            <QueuePill label="TDS challans pending" value={String(totals.pendingTdsChallans)} />
            <QueuePill label="Payments in current view" value={String((txns ?? []).length)} />
            <QueuePill label="Exports ready" value="CSV / Excel / PDF" />
          </CardContent>
        </Card>
      </section>

      <form className="grid gap-3 rounded-[24px] border border-border/70 bg-card px-4 py-4 md:grid-cols-[1fr_auto_auto_auto_auto]" method="get">
        <Input name="q" defaultValue={q} placeholder="Search vendor or reference…" className="md:max-w-xl" />
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
            <Link href="/app/purchases/payments-made">Reset</Link>
          </Button>
        </div>
      </form>

      <ApprovalStatusGuide />

      <Card>
        <CardHeader className="border-b border-border/60">
          <CardTitle className="text-base">Payment ledger</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
          <Table className="min-w-[1280px] table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[112px]">Date</TableHead>
                <TableHead className="w-[260px]">Vendor</TableHead>
                <TableHead className="hidden w-[240px] lg:table-cell">Project</TableHead>
                <TableHead className="w-[128px] text-right">Cash</TableHead>
                <TableHead className="w-[108px] text-right">TDS</TableHead>
                <TableHead className="w-[140px]">TDS deposit</TableHead>
                <TableHead className="w-[128px] text-right">Gross</TableHead>
                <TableHead className="hidden w-[148px] md:table-cell">Mode</TableHead>
                <TableHead className="hidden w-[240px] xl:table-cell">Reference</TableHead>
                <TableHead className="hidden w-[120px] md:table-cell">Review</TableHead>
                <TableHead className="w-[76px] text-right">Bills</TableHead>
                <TableHead className="w-[96px] text-right">Open</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(txns ?? []).length === 0 ? (
                <TableEmptyState
                  colSpan={12}
                  title="No payments matched this view"
                  description="Try widening the date range, clearing filters, or switching the active project context."
                />
              ) : (
                (txns ?? []).map((txn) => {
                  const cash = Number(txn.amount);
                  const tds = Number(txn.tdsAmount ?? 0);
                  const gross = cash + tds;
                  const bills = allocationCountByTxnId.get(txn.id) ?? 0;

                  return (
                    <TableRow key={txn.id}>
                      <TableCell>{txn.date.toISOString().slice(0, 10)}</TableCell>
                      <TableCell className="min-w-0">
                        <div className="min-w-0">
                          <Link className="block truncate font-semibold hover:underline" href={`/app/purchases/payments-made/${txn.id}`}>
                            {txn.vendor?.name ?? "-"}
                          </Link>
                          <div className="mt-1 truncate text-xs text-muted-foreground lg:hidden">
                            {txn.project?.name ?? "—"} • {txn.mode ?? "—"}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden truncate lg:table-cell">{txn.project?.name ?? "-"}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatINR(cash)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatINR(tds)}</TableCell>
                      <TableCell>
                        <TdsDepositBadge tds={tds} status={txn.tdsDepositStatus} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatINR(gross)}</TableCell>
                      <TableCell className="hidden truncate md:table-cell">{txn.mode ?? "-"}</TableCell>
                      <TableCell className="hidden truncate xl:table-cell">{txn.reference ?? "-"}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        <ApprovalStatusBadge status={txn.approvalStatus} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{bills}</TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="secondary">
                          <Link href={`/app/purchases/payments-made/${txn.id}`}>Open</Link>
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

function TdsDepositBadge({ tds, status }: { tds: number; status: "PENDING" | "DEPOSITED" }) {
  if (tds <= 0) return <span className="text-sm text-muted-foreground">No TDS</span>;
  return (
    <Badge variant={status === "DEPOSITED" ? "default" : "secondary"}>
      {status === "DEPOSITED" ? "Deposited" : "Pending"}
    </Badge>
  );
}
