import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { Prisma } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatINR } from "@/lib/money";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

export default async function TransactionsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  let txns:
    | Array<{
        id: string;
        type: string;
        date: Date;
        amount: any;
        project: { name: string } | null;
        category: { name: string } | null;
        fromAccount: { name: string; type: string } | null;
        toAccount: { name: string; type: string } | null;
      }>
    | null = null;

  try {
    txns = await prisma.transaction.findMany({
      where: { tenantId: session.user.tenantId },
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
    if (e instanceof Prisma.PrismaClientKnownRequestError && (e.code === "P2021" || e.code === "P2022")) {
      txns = null;
    } else {
      throw e;
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Transactions</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Quick income/expense/transfer entries (mobile-first).
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/app/transactions/new">New</Link>
          </Button>
        </div>
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

      <div className="overflow-x-auto rounded-md border">
        <Table className="min-w-[900px]">
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>From</TableHead>
              <TableHead>To</TableHead>
              <TableHead>Project</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(txns ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                  No transactions yet.
                </TableCell>
              </TableRow>
            ) : (
              (txns ?? []).map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{t.date.toISOString().slice(0, 10)}</TableCell>
                  <TableCell>{t.type}</TableCell>
                  <TableCell>{t.category?.name ?? "—"}</TableCell>
                  <TableCell>{t.fromAccount?.name ?? "—"}</TableCell>
                  <TableCell>{t.toAccount?.name ?? "—"}</TableCell>
                  <TableCell>{t.project?.name ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatINR(Number(t.amount))}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
