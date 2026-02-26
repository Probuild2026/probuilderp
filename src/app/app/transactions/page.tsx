import Link from "next/link";
import { getServerSession } from "next-auth/next";

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

function money(value: { toFixed: (n: number) => string } | number) {
  if (typeof value === "number") return value.toFixed(2);
  return value.toFixed(2);
}

export default async function TransactionsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const txns = await prisma.transaction.findMany({
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
            {txns.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                  No transactions yet.
                </TableCell>
              </TableRow>
            ) : (
              txns.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{t.date.toISOString().slice(0, 10)}</TableCell>
                  <TableCell>{t.type}</TableCell>
                  <TableCell>{t.category?.name ?? "—"}</TableCell>
                  <TableCell>{t.fromAccount?.name ?? "—"}</TableCell>
                  <TableCell>{t.toAccount?.name ?? "—"}</TableCell>
                  <TableCell>{t.project?.name ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(t.amount)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

