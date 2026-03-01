import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { Prisma } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatINR } from "@/lib/money";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

export default async function PaymentsMadePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  let txns:
    | Array<{
        id: string;
        date: Date;
        amount: any;
        tdsAmount: any;
        mode: string | null;
        reference: string | null;
        vendor: { id: string; name: string } | null;
        project: { id: string; name: string } | null;
      }>
    | null = null;
  let allocationCountByTxnId: Map<string, number> = new Map();

  try {
    txns = await prisma.transaction.findMany({
      where: { tenantId: session.user.tenantId, type: "EXPENSE", vendorId: { not: null } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 200,
      select: {
        id: true,
        date: true,
        amount: true,
        tdsAmount: true,
        mode: true,
        reference: true,
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
    if (e instanceof Prisma.PrismaClientKnownRequestError && (e.code === "P2021" || e.code === "P2022")) {
      txns = null;
    } else {
      throw e;
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Payments Made</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Vendor/Subcontractor payments. TDS (194C) is auto-calculated for this flow.
          </p>
        </div>
        <Button asChild>
          <Link href="/app/purchases/payments-made/new">New Payment</Link>
        </Button>
      </div>

      {txns === null ? (
        <div className="rounded-md border bg-muted/20 p-4 text-sm">
          <div className="font-medium">Database update required</div>
          <div className="mt-1 text-muted-foreground">
            Your app code is deployed, but your database is missing required tables/columns. Run Prisma migrations against the Vercel DB, then refresh.
          </div>
          <pre className="mt-3 overflow-x-auto rounded-md bg-black/40 p-3 text-xs">
{`cd "/Users/roshanvinayan/Documents/Probuild ERP/probuild-erp"

# Use the EXACT DATABASE_URL from Vercel (Settings → Environment Variables)
DATABASE_URL='postgres://...your-vercel-db-url...' npx prisma migrate deploy
DATABASE_URL='postgres://...your-vercel-db-url...' npx prisma db seed`}
          </pre>
        </div>
      ) : null}

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
                <TableHead className="hidden md:table-cell text-right">Bills</TableHead>
                <TableHead className="w-[1%] text-right">Open</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(txns ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="py-10 text-center text-sm text-muted-foreground">
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
                            {t.project?.name ?? "—"} • {t.mode ?? "—"} • Bills {bills}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell max-w-[260px] truncate">{t.project?.name ?? "-"}</TableCell>
                      <TableCell className="whitespace-nowrap text-right tabular-nums">{formatINR(cash)}</TableCell>
                      <TableCell className="hidden sm:table-cell whitespace-nowrap text-right tabular-nums">{formatINR(tds)}</TableCell>
                      <TableCell className="hidden md:table-cell whitespace-nowrap text-right tabular-nums">{formatINR(gross)}</TableCell>
                      <TableCell className="hidden md:table-cell whitespace-nowrap">{t.mode ?? "-"}</TableCell>
                      <TableCell className="hidden xl:table-cell max-w-[260px] truncate">{t.reference ?? "-"}</TableCell>
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
