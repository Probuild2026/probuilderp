import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { Prisma } from "@prisma/client";

import { ExportLinks } from "@/components/app/export-links";
import { PageHeader } from "@/components/app/page-header";
import { EntryRoutingHelpModal } from "@/components/help/entry-routing-help-modal";
import { ModuleCheatSheet } from "@/components/help/module-cheat-sheet";
import { Button } from "@/components/ui/button";
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

  const hasTransferRows = (txns ?? []).some((t) => t.type === "TRANSFER");

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <PageHeader
        title="Transactions"
        description="Quick income/expense/transfer entries (mobile-first)."
        action={{ label: "New", href: "/app/transactions/new" }}
        actions={<ExportLinks hrefBase="/api/exports/transactions" params={{ from, to }} />}
        actionSecondary={<EntryRoutingHelpModal />}
      />

      <ModuleCheatSheet moduleKey="transactions" variant="compact" />

      <form className="grid gap-2 rounded-md border p-3 md:grid-cols-[auto_auto_auto]" method="get">
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

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[110px]">Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="hidden lg:table-cell">Category</TableHead>
              {hasTransferRows ? <TableHead className="hidden md:table-cell">From</TableHead> : null}
              {hasTransferRows ? <TableHead className="hidden md:table-cell">To</TableHead> : null}
              <TableHead className="hidden lg:table-cell">Project</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(txns ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={hasTransferRows ? 7 : 5} className="py-8 text-center text-sm text-muted-foreground">
                  No transactions yet.
                </TableCell>
              </TableRow>
            ) : (
              (txns ?? []).map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="whitespace-nowrap">{t.date.toISOString().slice(0, 10)}</TableCell>
                  <TableCell className="min-w-0">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{t.type}</div>
                      <div className="mt-0.5 truncate text-xs text-muted-foreground md:hidden">
                        {(t.category?.name ?? "—") + " • " + (t.project?.name ?? "—")}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">{t.category?.name ?? t.type}</TableCell>
                  {hasTransferRows ? <TableCell className="hidden md:table-cell">{t.type === "TRANSFER" ? t.fromAccount?.name ?? "—" : "—"}</TableCell> : null}
                  {hasTransferRows ? <TableCell className="hidden md:table-cell">{t.type === "TRANSFER" ? t.toAccount?.name ?? "—" : "—"}</TableCell> : null}
                  <TableCell className="hidden lg:table-cell">{t.project?.name ?? "—"}</TableCell>
                  <TableCell className="whitespace-nowrap text-right tabular-nums">{formatINR(Number(t.amount))}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
