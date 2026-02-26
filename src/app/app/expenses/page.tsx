import Link from "next/link";
import { getServerSession } from "next-auth/next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const q = typeof searchParams?.q === "string" ? searchParams.q : "";

  const expenses = await prisma.expense.findMany({
    where: {
      tenantId: session.user.tenantId,
      ...(q
        ? {
            OR: [
              { narration: { contains: q, mode: "insensitive" } },
              { vendor: { name: { contains: q, mode: "insensitive" } } },
              { project: { name: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    include: {
      project: { select: { id: true, name: true } },
      vendor: { select: { id: true, name: true } },
      labourer: { select: { id: true, name: true } },
    },
    orderBy: { date: "desc" },
    take: 100,
  });

  const attachmentCounts = await prisma.attachment.groupBy({
    by: ["entityId"],
    where: { tenantId: session.user.tenantId, entityType: "EXPENSE", entityId: { in: expenses.map((e) => e.id) } },
    _count: { _all: true },
  });
  const attachmentCountByExpense = new Map(attachmentCounts.map((a) => [a.entityId, a._count._all]));

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Expenses</h1>
          <p className="mt-1 text-sm text-muted-foreground">Daily expenses, labour, overheads.</p>
        </div>
        <Button asChild>
          <Link href="/app/expenses/new">New Expense</Link>
        </Button>
      </div>

      <form className="flex flex-wrap gap-3" action="/app/expenses" method="get">
        <Input name="q" placeholder="Search narration/vendor/project..." defaultValue={q} className="max-w-sm" />
        <button className="h-10 rounded-md bg-primary px-4 text-sm text-primary-foreground" type="submit">
          Apply
        </button>
        <Link className="h-10 rounded-md border px-4 text-sm leading-10" href="/app/expenses">
          Reset
        </Link>
      </form>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Project</TableHead>
            <TableHead>Vendor/Labour</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Paid via</TableHead>
            <TableHead>Bills</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {expenses.map((e) => (
            <TableRow key={e.id}>
              <TableCell>{e.date.toISOString().slice(0, 10)}</TableCell>
              <TableCell>{e.project.name}</TableCell>
              <TableCell>{e.vendor?.name ?? e.labourer?.name ?? "-"}</TableCell>
              <TableCell>{e.expenseType}</TableCell>
              <TableCell className="text-right">{e.totalAmount.toString()}</TableCell>
              <TableCell>{e.paymentMode ?? "-"}</TableCell>
              <TableCell>{attachmentCountByExpense.get(e.id) ?? 0}</TableCell>
            </TableRow>
          ))}
          {expenses.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                No expenses yet.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  );
}
