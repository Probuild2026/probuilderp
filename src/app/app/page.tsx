import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";

import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function formatINR(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(n);
}

function isDbUnavailable(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (error instanceof Prisma.PrismaClientKnownRequestError) return error.code === "P1001" || error.code === "P1002";
  return message.includes("Can't reach database server") || message.includes("P1001");
}

export default async function AppHomePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const today = new Date();
  const from = startOfMonth(today);
  const to = today;

  let totalReceived = 0;
  let totalBills = 0;
  let totalExpenses = 0;
  let totalWages = 0;
  let projects: Array<{ id: string; name: string; status: string; client: { name: string } | null }> = [];
  let dbUnavailable = false;

  try {
    const [receivedAgg, billsAgg, expensesAgg, wagesAgg, projectRows] = await Promise.all([
      prisma.receipt.aggregate({
        where: { tenantId: session.user.tenantId, date: { gte: from, lte: to } },
        _sum: { amountReceived: true },
      }),
      prisma.purchaseInvoice.aggregate({
        where: { tenantId: session.user.tenantId, invoiceDate: { gte: from, lte: to } },
        _sum: { total: true },
      }),
      prisma.expense.aggregate({
        where: { tenantId: session.user.tenantId, date: { gte: from, lte: to } },
        _sum: { totalAmount: true },
      }),
      prisma.labourSheet.aggregate({
        where: { tenantId: session.user.tenantId, date: { gte: from, lte: to } },
        _sum: { total: true },
      }),
      prisma.project.findMany({
        where: { tenantId: session.user.tenantId },
        orderBy: { createdAt: "desc" },
        take: 25,
        select: {
          id: true,
          name: true,
          status: true,
          client: { select: { name: true } },
        },
      }),
    ]);
    totalReceived = Number(receivedAgg._sum.amountReceived ?? 0);
    totalBills = Number(billsAgg._sum.total ?? 0);
    totalExpenses = Number(expensesAgg._sum.totalAmount ?? 0);
    totalWages = Number(wagesAgg._sum.total ?? 0);
    projects = projectRows;
  } catch (e) {
    if (isDbUnavailable(e)) {
      dbUnavailable = true;
    } else {
      throw e;
    }
  }

  const totalSpent = totalBills + totalExpenses + totalWages;
  const net = totalReceived - totalSpent;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <PageHeader
        title="Dashboard"
        description="Track projects, cash, GST/TDS and key site activity."
        actions={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button>+ New transaction</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href="/app/purchases/bills/new">Bill</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/app/purchases/payments-made/new">Vendor payment</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/app/sales/receipts/new">Receipt</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/app/expenses/new">Expense</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/app/wages/new">Wage</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/app/transactions/new">Quick transaction</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />
      {dbUnavailable ? (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
          Database temporarily unreachable from Vercel. Dashboard metrics are hidden until connectivity is restored.
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="cursor-pointer transition hover:bg-muted/30">
          <Link href="/app/sales/receipts" className="block">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total received (this month)</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{formatINR(totalReceived)}</CardContent>
          </Link>
        </Card>
        <Card className="cursor-pointer transition hover:bg-muted/30">
          <Link href="/app/purchases/bills" className="block">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total spent (bills+wages+expenses)</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{formatINR(totalSpent)}</CardContent>
          </Link>
        </Card>
        <Card className="cursor-pointer transition hover:bg-muted/30">
          <Link href="/app/transactions" className="block">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Net position (this month)</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{formatINR(net)}</CardContent>
          </Link>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">Projects overview</CardTitle>
            <Button asChild variant="outline" size="sm">
              <Link href="/app/projects">View all</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead className="hidden md:table-cell">Client</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[1%] text-right">Open</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                      No projects yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  projects.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="min-w-0">
                        <div className="min-w-0">
                          <div className="truncate font-medium">{p.name}</div>
                          <div className="mt-0.5 truncate text-xs text-muted-foreground md:hidden">{p.client?.name ?? "—"}</div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{p.client?.name ?? "—"}</TableCell>
                      <TableCell>{p.status}</TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="secondary">
                          <Link href={`/app/projects/${p.id}`}>Open</Link>
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

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Simple rule to remember</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            <li>
              <span className="text-foreground">Bills</span> = Purchase/expense from a vendor where you get a bill/invoice.
            </li>
            <li>
              <span className="text-foreground">Payments Made</span> = How you paid that bill (Cash / UPI / Bank Transfer etc.).
            </li>
            <li>
              <span className="text-foreground">Receipts</span> = Money received from client.
            </li>
          </ul>

          <div className="grid gap-2 sm:grid-cols-3">
            <Button asChild variant="outline" className="justify-start">
              <Link href="/app/purchases/bills">Go to Bills</Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link href="/app/purchases/payments-made">Go to Payments Made</Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link href="/app/sales/receipts">Go to Receipts</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Setup checklist</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <div>
              1) <Link className="text-foreground underline underline-offset-4" href="/app/settings/business">Business</Link>:
              logo, GSTIN/PAN, address, bank/UPI (used on invoices/receipts/vouchers).
            </div>
            <div>
              2) Masters:{" "}
              <Link className="text-foreground underline underline-offset-4" href="/app/clients">Clients</Link>,{" "}
              <Link className="text-foreground underline underline-offset-4" href="/app/vendors">Vendors/Subcontractors</Link>,{" "}
              <Link className="text-foreground underline underline-offset-4" href="/app/projects">Projects</Link>.
            </div>
            <div>
              3) Daily entries:{" "}
              <Link className="text-foreground underline underline-offset-4" href="/app/expenses">Expenses</Link> and{" "}
              <Link className="text-foreground underline underline-offset-4" href="/app/wages">Wages</Link>.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">When to use Transactions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <div>
              Use <span className="text-foreground">Transactions</span> for quick cashbook entries (income/expense/transfer) when you don’t have a bill or
              invoice yet.
            </div>
            <div>
              For vendor bills + payments, prefer{" "}
              <Link className="text-foreground underline underline-offset-4" href="/app/purchases/bills">Bills</Link> and{" "}
              <Link className="text-foreground underline underline-offset-4" href="/app/purchases/payments-made">Payments Made</Link>.
            </div>
            <div>
              For client money received, use{" "}
              <Link className="text-foreground underline underline-offset-4" href="/app/sales/receipts">Receipts</Link>.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
