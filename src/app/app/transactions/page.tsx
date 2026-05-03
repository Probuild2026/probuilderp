import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { Prisma } from "@prisma/client";
import { ArrowLeftRight, Landmark, TrendingDown, TrendingUp, UsersRound } from "lucide-react";

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
import { getCashLedgerPage } from "@/server/cash-ledger";
import { prisma } from "@/server/db";

const PAGE_SIZE = 50;

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

  const categoryId = Array.isArray(sp.category) ? sp.category[0] : sp.category;
  const sortParam = Array.isArray(sp.sort) ? sp.sort[0] : sp.sort;
  const sort = sortParam || "date-desc";
  const pageParam = Array.isArray(sp.page) ? sp.page[0] : sp.page;
  const currentPage = Math.max(1, Number(pageParam) || 1);

  let ledger: Awaited<ReturnType<typeof getCashLedgerPage>> | null = null;
  let dbUnavailable = false;
  let categories: Array<{ id: string; name: string }> = [];

  try {
    categories = await prisma.txnCategory.findMany({
      where: { tenantId: session.user.tenantId, active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });

    ledger = await getCashLedgerPage({
      tenantId: session.user.tenantId,
      projectId,
      dateRange,
      categoryId,
      sort: sort === "date-asc" || sort === "amount-desc" || sort === "amount-asc" ? sort : "date-desc",
      limit: PAGE_SIZE,
      offset: (currentPage - 1) * PAGE_SIZE,
    });
  } catch (e) {
    if (
      (e instanceof Prisma.PrismaClientKnownRequestError && (e.code === "P2021" || e.code === "P2022" || e.code === "P1001")) ||
      (e instanceof Error && e.message.includes("Can't reach database server"))
    ) {
      ledger = null;
      dbUnavailable =
        (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P1001") ||
        (e instanceof Error && e.message.includes("Can't reach database server"));
    } else {
      throw e;
    }
  }

  const rows = ledger?.rows ?? [];
  const totals = ledger?.totals ?? { income: 0, expense: 0, transfer: 0, partner: 0 };
  const hasTransferRows = rows.some((row) => row.type === "TRANSFER");
  const sourceCount = ledger?.sourceCount ?? 0;
  const totalRows = ledger?.totalRows ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
  const firstRow = rows.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const lastRow = rows.length === 0 ? 0 : Math.min(currentPage * PAGE_SIZE, totalRows);

  function pageHref(page: number) {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (categoryId) params.set("category", categoryId);
    if (sort) params.set("sort", sort);
    if (page > 1) params.set("page", String(page));
    const query = params.toString();
    return query ? `/app/transactions?${query}` : "/app/transactions";
  }

  return (
    <div className="w-full space-y-6 p-4 md:p-6">
      <PageHeader
        eyebrow="Finance / Transactions"
        title="Transactions"
        description="Use this as the full cash movement ledger across receipts, payments made, direct expenses, wages, partner payouts, TDS payments, and manual transfers."
        action={{ label: "New transaction", href: "/app/transactions/new" }}
        actions={<ExportLinks hrefBase="/api/exports/transactions" params={{ from, to }} />}
        actionSecondary={<EntryRoutingHelpModal />}
      />

      <ModuleCheatSheet moduleKey="transactions" variant="compact" />

      <form className="grid gap-3 rounded-[24px] border border-border/70 bg-card px-4 py-4 md:grid-cols-[auto_auto_1fr_1fr_auto]" method="get">
        <Input name="from" type="date" defaultValue={from} className="md:w-[140px]" />
        <Input name="to" type="date" defaultValue={to} className="md:w-[140px]" />
        <select name="category" defaultValue={categoryId} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50">
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select name="sort" defaultValue={sort} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50">
          <option value="date-desc">Newest first</option>
          <option value="date-asc">Oldest first</option>
          <option value="amount-desc">Amount (High to Low)</option>
          <option value="amount-asc">Amount (Low to High)</option>
        </select>
        <div className="flex gap-2">
          <Button type="submit">Apply</Button>
          <Button asChild variant="outline">
            <Link href="/app/transactions">Reset</Link>
          </Button>
        </div>
      </form>

      {ledger === null ? (
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
            <SummaryTile icon={UsersRound} label="Partner payouts" value={formatINR(totals.partner)} />
            <SummaryTile icon={ArrowLeftRight} label="Transfers" value={formatINR(totals.transfer)} />
            <SummaryTile icon={Landmark} label="Net movement" value={formatINR(totals.income - totals.expense)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border/60">
            <CardTitle className="text-base">Ledger scope</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-6">
            <QueuePill label="Rows matching filters" value={String(totalRows)} />
            <QueuePill label="Page size" value={String(PAGE_SIZE)} />
            <QueuePill label="Source modules" value={String(sourceCount)} />
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
          <Table className="min-w-[1080px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[110px]">Date</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="hidden lg:table-cell">Category</TableHead>
                <TableHead className="hidden xl:table-cell">Mode</TableHead>
                {hasTransferRows ? <TableHead className="hidden md:table-cell">From</TableHead> : null}
                {hasTransferRows ? <TableHead className="hidden md:table-cell">To</TableHead> : null}
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Open</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableEmptyState
                  colSpan={hasTransferRows ? 9 : 7}
                  title="No transactions matched this view"
                  description="Try widening the date range or switching the current project filter."
                />
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.date.toISOString().slice(0, 10)}</TableCell>
                    <TableCell className="min-w-0">
                      <Link href={row.sourceHref} className="truncate font-semibold hover:underline">
                        {row.sourceLabel}
                      </Link>
                      <div className="mt-1 truncate text-xs text-muted-foreground xl:hidden">
                        {row.mode ?? "—"}
                      </div>
                    </TableCell>
                    <TableCell className="min-w-0">
                      <div className="min-w-0">
                        <span className="truncate font-semibold">{row.type}</span>
                        <div className="mt-1 truncate text-xs text-muted-foreground md:hidden">
                          {row.categoryName ?? "—"}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">{row.categoryName ?? row.type}</TableCell>
                    <TableCell className="hidden xl:table-cell">{row.mode ?? "—"}</TableCell>
                    {hasTransferRows ? <TableCell className="hidden md:table-cell">{row.type === "TRANSFER" ? row.fromAccountName ?? "—" : "—"}</TableCell> : null}
                    {hasTransferRows ? <TableCell className="hidden md:table-cell">{row.type === "TRANSFER" ? row.toAccountName ?? "—" : "—"}</TableCell> : null}
                    <TableCell className="text-right tabular-nums">{formatINR(Number(row.amount))}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link href={row.sourceHref}>Open</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>
          <div className="flex flex-col gap-3 border-t border-border/60 px-4 py-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <div>
              Showing {firstRow}-{lastRow} of {totalRows} rows
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <PaginationButton href={pageHref(1)} disabled={currentPage <= 1}>
                First
              </PaginationButton>
              <PaginationButton href={pageHref(currentPage - 1)} disabled={currentPage <= 1}>
                Previous
              </PaginationButton>
              <span className="px-2 text-xs font-semibold uppercase tracking-[0.14em]">
                Page {Math.min(currentPage, totalPages)} / {totalPages}
              </span>
              <PaginationButton href={pageHref(currentPage + 1)} disabled={currentPage >= totalPages}>
                Next
              </PaginationButton>
              <PaginationButton href={pageHref(totalPages)} disabled={currentPage >= totalPages}>
                Last
              </PaginationButton>
            </div>
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

function PaginationButton({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <Button size="sm" variant="outline" disabled>
        {children}
      </Button>
    );
  }

  return (
    <Button asChild size="sm" variant="outline">
      <Link href={href}>{children}</Link>
    </Button>
  );
}
