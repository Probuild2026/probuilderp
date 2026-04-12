import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { Prisma } from "@prisma/client";
import { ArrowLeftRight, Landmark, TrendingDown, TrendingUp } from "lucide-react";

import { ExportLinks } from "@/components/app/export-links";
import { PageHeader } from "@/components/app/page-header";
import { StatePanel, TableEmptyState } from "@/components/app/state-panels";
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

export default async function TransactionsPage({
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

  let txns:
    | Array<{
        id: string;
        type: string;
        date: Date;
        amount: Prisma.Decimal;
        project: { name: string } | null;
        category: { name: string } | null;
        fromAccount: { name: string; type: string } | null;
        toAccount: { name: string; type: string } | null;
      }>
    | null = null;
  let dbUnavailable = false;

  try {
    txns = await prisma.transaction.findMany({
      where: {
        tenantId: session.user.tenantId,
        ...(projectId ? { projectId } : {}),
        ...(dateRange ? { date: dateRange } : {}),
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 200,
      include: {
        project: { select: { name: true } },
        category: { select: { name: true } },
        fromAccount: { select: { name: true, type: true } },
        toAccount: { select: { name: true, type: true } },
      },
    });
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
    (acc, txn) => {
      const amount = Number(txn.amount);
      if (txn.type === "INCOME") acc.income += amount;
      if (txn.type === "EXPENSE") acc.expense += amount;
      if (txn.type === "TRANSFER") acc.transfer += amount;
      return acc;
    },
    { income: 0, expense: 0, transfer: 0 },
  );
  const hasTransferRows = (txns ?? []).some((txn) => txn.type === "TRANSFER");

  return (
    <div className="mx-auto max-w-[1440px] space-y-6 p-4 md:p-6">
      <PageHeader
        eyebrow="Finance / Transactions"
        title="Transactions"
        description="Use the cashbook ledger for quick income, expense, and transfer entries when a fuller bill or invoice workflow is not required."
        action={{ label: "New transaction", href: "/app/transactions/new" }}
        actions={<ExportLinks hrefBase="/api/exports/transactions" params={{ from, to }} />}
        actionSecondary={<EntryRoutingHelpModal />}
      />

      <ModuleCheatSheet moduleKey="transactions" variant="compact" />

      <form className="grid gap-3 rounded-[24px] border border-border/70 bg-card px-4 py-4 md:grid-cols-[auto_auto_auto]" method="get">
        <Input name="from" type="date" defaultValue={from} />
        <Input name="to" type="date" defaultValue={to} />
        <div className="flex gap-2">
          <Button type="submit">Apply</Button>
          <Button asChild variant="outline">
            <Link href="/app/transactions">Reset</Link>
          </Button>
        </div>
      </form>

      {txns === null ? (
        <StatePanel
          tone="warning"
          title={dbUnavailable ? "Database temporarily unreachable" : "Database update required"}
          description={
            dbUnavailable
              ? "The app could not connect to the database. Check DATABASE_URL or Prisma Postgres availability and refresh."
              : "This deployment is missing required database objects for the transaction ledger. Apply Prisma migrations, then refresh."
          }
        />
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader className="border-b border-border/60">
            <CardTitle className="text-base">Cashbook summary</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 pt-6 sm:grid-cols-2 2xl:grid-cols-4">
            <SummaryTile icon={TrendingUp} label="Income" value={formatINR(totals.income)} />
            <SummaryTile icon={TrendingDown} label="Expense" value={formatINR(totals.expense)} />
            <SummaryTile icon={ArrowLeftRight} label="Transfers" value={formatINR(totals.transfer)} />
            <SummaryTile icon={Landmark} label="Net movement" value={formatINR(totals.income - totals.expense)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border/60">
            <CardTitle className="text-base">Ledger scope</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-6">
            <QueuePill label="Rows in current view" value={String((txns ?? []).length)} />
            <QueuePill label="Transfer columns" value={hasTransferRows ? "Visible" : "Hidden"} />
            <QueuePill label="Export status" value="CSV / Excel / PDF" />
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader className="border-b border-border/60">
          <CardTitle className="text-base">Transaction ledger</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
          <Table className="min-w-[920px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[110px]">Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="hidden lg:table-cell">Category</TableHead>
                {hasTransferRows ? <TableHead className="hidden md:table-cell">From</TableHead> : null}
                {hasTransferRows ? <TableHead className="hidden md:table-cell">To</TableHead> : null}
                <TableHead className="hidden lg:table-cell">Project</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Open</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(txns ?? []).length === 0 ? (
                <TableEmptyState
                  colSpan={hasTransferRows ? 8 : 6}
                  title="No transactions matched this view"
                  description="Try widening the date range or switching the current project filter."
                />
              ) : (
                (txns ?? []).map((txn) => (
                  <TableRow key={txn.id}>
                    <TableCell>{txn.date.toISOString().slice(0, 10)}</TableCell>
                    <TableCell className="min-w-0">
                      <div className="min-w-0">
                        <Link href={`/app/transactions/${txn.id}`} className="truncate font-semibold hover:underline">
                          {txn.type}
                        </Link>
                        <div className="mt-1 truncate text-xs text-muted-foreground md:hidden">
                          {(txn.category?.name ?? "—") + " • " + (txn.project?.name ?? "—")}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">{txn.category?.name ?? txn.type}</TableCell>
                    {hasTransferRows ? <TableCell className="hidden md:table-cell">{txn.type === "TRANSFER" ? txn.fromAccount?.name ?? "—" : "—"}</TableCell> : null}
                    {hasTransferRows ? <TableCell className="hidden md:table-cell">{txn.type === "TRANSFER" ? txn.toAccount?.name ?? "—" : "—"}</TableCell> : null}
                    <TableCell className="hidden lg:table-cell">{txn.project?.name ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatINR(Number(txn.amount))}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/app/transactions/${txn.id}`}>Open</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
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
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-[22px] border border-border/60 bg-background/70 px-4 py-4">
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
