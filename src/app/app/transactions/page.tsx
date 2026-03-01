import { getServerSession } from "next-auth/next";
import { Prisma } from "@prisma/client";

import { PageHeader } from "@/components/app/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatINR } from "@/lib/money";
import { getSelectedProjectId } from "@/lib/project-filter";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

export default async function TransactionsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const projectId = await getSelectedProjectId();

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
      where: {
        tenantId: session.user.tenantId,
        ...(projectId ? { projectId } : {}),
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
    if (e instanceof Prisma.PrismaClientKnownRequestError && (e.code === "P2021" || e.code === "P2022")) {
      txns = null;
    } else {
      throw e;
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <PageHeader
        title="Transactions"
        description="Quick income/expense/transfer entries (mobile-first)."
        action={{ label: "New", href: "/app/transactions/new" }}
      />

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

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[110px]">Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="hidden lg:table-cell">Category</TableHead>
              <TableHead className="hidden md:table-cell">From</TableHead>
              <TableHead className="hidden md:table-cell">To</TableHead>
              <TableHead className="hidden lg:table-cell">Project</TableHead>
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
                  <TableCell className="whitespace-nowrap">{t.date.toISOString().slice(0, 10)}</TableCell>
                  <TableCell className="min-w-0">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{t.type}</div>
                      <div className="mt-0.5 truncate text-xs text-muted-foreground md:hidden">
                        {(t.category?.name ?? "—") + " • " + (t.project?.name ?? "—")}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">{t.category?.name ?? "—"}</TableCell>
                  <TableCell className="hidden md:table-cell">{t.fromAccount?.name ?? "—"}</TableCell>
                  <TableCell className="hidden md:table-cell">{t.toAccount?.name ?? "—"}</TableCell>
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
