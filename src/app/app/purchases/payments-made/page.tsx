import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { Prisma } from "@prisma/client";

import { ApprovalStatusBadge } from "@/components/app/approval-status-badge";
import { ApprovalStatusGuide } from "@/components/app/approval-status-guide";
import { ExportLinks } from "@/components/app/export-links";
import { PageHeader } from "@/components/app/page-header";
import { EntryRoutingHelpModal } from "@/components/help/entry-routing-help-modal";
import { ModuleCheatSheet } from "@/components/help/module-cheat-sheet";
import { Card, CardContent } from "@/components/ui/card";
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
        ...(from || to
          ? { date: dateRange }
          : {}),
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
        approvalStatus: true,
        vendor: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
      },
    });

    // Avoid Prisma relation `_count` (can generate database-specific aggregate queries).
    const txnIds = txns.map((t) => t.id);
    if (txnIds.length > 0) {
      const allocs = await prisma.transactionAllocation.findMany({
        where: { tenantId: session.user.tenantId, transactionId: { in: txnIds } },
        select: { transactionId: true },
      });
      allocationCountByTxnId = new Map();
      for (const a of allocs) {
        allocationCountByTxnId.set(a.transactionId, (allocationCountByTxnId.get(a.transactionId) ?? 0) + 1);
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
      return acc;
    },
    { cash: 0, tds: 0, gross: 0 },
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <PageHeader
        title="Payments Made"
        description="Vendor/Subcontractor payments. TDS (194C) is auto-calculated for this flow."
        action={{ label: "New Payment", href: "/app/purchases/payments-made/new" }}
        actions={<ExportLinks hrefBase="/api/exports/payments-made" params={{ q, from, to, approval }} />}
        actionSecondary={<EntryRoutingHelpModal />}
      />

      <ModuleCheatSheet moduleKey="paymentsMade" variant="compact" />

      <form className="grid gap-2 rounded-md border p-3 md:grid-cols-[1fr_auto_auto_auto_auto]" method="get">
        <Input
          name="q"
          defaultValue={q}
          placeholder="Search vendor/reference…"
          className="md:max-w-xl"
        />
        <select
          name="approval"
          defaultValue={approval ?? ""}
          className="h-10 rounded-md border bg-background px-3 text-sm"
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

      {txns === null ? (
        <div className="rounded-md border bg-muted/20 p-4 text-sm">
          <div className="font-medium">{dbUnavailable ? "Database temporarily unreachable" : "Database update required"}</div>
          <div className="mt-1 text-muted-foreground">
            {dbUnavailable
              ? "The app could not connect to the database. Check DATABASE_URL / Prisma Postgres status in Vercel, then refresh."
              : "Your app code is deployed, but your database is missing required tables/columns. Run Prisma migrations against the Vercel DB, then refresh."}
          </div>
          <pre className="mt-3 overflow-x-auto rounded-md bg-black/40 p-3 text-xs">
{`cd "/Users/roshanvinayan/Documents/Probuild ERP/probuild-erp"

# Use the EXACT DATABASE_URL from Vercel (Settings → Environment Variables)
DATABASE_URL='postgres://...your-vercel-db-url...' npx prisma migrate deploy
DATABASE_URL='postgres://...your-vercel-db-url...' npx prisma db seed`}
          </pre>
        </div>
      ) : null}

      <div className="rounded-md border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
        Showing {(txns ?? []).length} payments • Cash {formatINR(totals.cash)} • TDS {formatINR(totals.tds)} • Gross {formatINR(totals.gross)}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[110px]">Date</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead className="hidden lg:table-cell">Project</TableHead>
                <TableHead className="text-right">Cash</TableHead>
                <TableHead className="hidden sm:table-cell text-right">TDS</TableHead>
                <TableHead className="hidden md:table-cell text-right">Gross</TableHead>
                <TableHead className="hidden md:table-cell">Mode</TableHead>
                <TableHead className="hidden xl:table-cell">Reference</TableHead>
                <TableHead className="hidden md:table-cell">Review</TableHead>
                <TableHead className="hidden md:table-cell text-right">Bills</TableHead>
                <TableHead className="w-[1%] text-right">Open</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(txns ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="py-10 text-center text-sm text-muted-foreground">
                    No payments yet.
                  </TableCell>
                </TableRow>
              ) : (
                (txns ?? []).map((t) => {
                  const cash = Number(t.amount);
                  const tds = Number(t.tdsAmount ?? 0);
                  const gross = cash + tds;
                  const bills = allocationCountByTxnId.get(t.id) ?? 0;
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="whitespace-nowrap">{t.date.toISOString().slice(0, 10)}</TableCell>
                      <TableCell className="min-w-0">
                        <div className="min-w-0">
                          <Link className="block truncate font-medium hover:underline" href={`/app/purchases/payments-made/${t.id}`}>
                            {t.vendor?.name ?? "-"}
                          </Link>
                          <div className="mt-0.5 truncate text-xs text-muted-foreground lg:hidden">
                            {t.project?.name ?? "—"} • {t.mode ?? "—"} • {approvalStatusLabels[t.approvalStatus]} • Bills {bills}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell max-w-[260px] truncate">{t.project?.name ?? "-"}</TableCell>
                      <TableCell className="whitespace-nowrap text-right tabular-nums">{formatINR(cash)}</TableCell>
                      <TableCell className="hidden sm:table-cell whitespace-nowrap text-right tabular-nums">{formatINR(tds)}</TableCell>
                      <TableCell className="hidden md:table-cell whitespace-nowrap text-right tabular-nums">{formatINR(gross)}</TableCell>
                      <TableCell className="hidden md:table-cell whitespace-nowrap">{t.mode ?? "-"}</TableCell>
                      <TableCell className="hidden xl:table-cell max-w-[260px] truncate">{t.reference ?? "-"}</TableCell>
                      <TableCell className="hidden md:table-cell"><ApprovalStatusBadge status={t.approvalStatus} /></TableCell>
                      <TableCell className="hidden md:table-cell whitespace-nowrap text-right tabular-nums">{bills}</TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="secondary">
                          <Link href={`/app/purchases/payments-made/${t.id}`}>Open</Link>
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
