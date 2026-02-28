import Link from "next/link";
import { getServerSession } from "next-auth/next";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatINR } from "@/lib/money";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

function statusFromSettled(total: number, settled: number) {
  if (settled >= total) return "PAID";
  if (settled > 0) return "PARTIAL";
  return "DUE";
}

export default async function InvoicesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const invoices = await prisma.clientInvoice.findMany({
    where: { tenantId: session.user.tenantId },
    orderBy: [{ invoiceDate: "desc" }, { createdAt: "desc" }],
    take: 200,
    select: {
      id: true,
      invoiceNumber: true,
      invoiceDate: true,
      total: true,
      basicValue: true,
      project: { select: { name: true } },
      client: { select: { name: true } },
    },
  });

  const allocs = await prisma.transactionAllocation.groupBy({
    by: ["documentId"],
    where: { tenantId: session.user.tenantId, documentType: "CLIENT_INVOICE" },
    _sum: { cashAmount: true, tdsAmount: true, grossAmount: true },
  });
  const byInvoiceId = new Map(
    allocs.map((a) => [
      a.documentId,
      {
        cash: Number(a._sum.cashAmount ?? 0),
        tds: Number(a._sum.tdsAmount ?? 0),
        gross: Number(a._sum.grossAmount ?? 0),
      },
    ]),
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Invoices</h1>
          <p className="mt-1 text-sm text-muted-foreground">Create GST invoices and track receipts + TDS.</p>
        </div>
        <Button asChild>
          <Link href="/app/sales/invoices/new">New invoice</Link>
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead className="text-right">Basic</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Received</TableHead>
                  <TableHead className="text-right">TDS</TableHead>
                  <TableHead className="text-right">Settled</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Open</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="py-10 text-center text-sm text-muted-foreground">
                      No invoices yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  invoices.map((inv) => (
                    (() => {
                      const a = byInvoiceId.get(inv.id) ?? { cash: 0, tds: 0, gross: 0 };
                      const status = statusFromSettled(Number(inv.total), a.gross);
                      return (
                    <TableRow key={inv.id}>
                      <TableCell>{inv.invoiceDate.toISOString().slice(0, 10)}</TableCell>
                      <TableCell className="font-medium">{inv.invoiceNumber}</TableCell>
                      <TableCell className="max-w-[260px] truncate">{inv.project.name}</TableCell>
                      <TableCell className="max-w-[260px] truncate">{inv.client.name}</TableCell>
                      <TableCell className="text-right">{formatINR(Number(inv.basicValue))}</TableCell>
                      <TableCell className="text-right">{formatINR(Number(inv.total))}</TableCell>
                      <TableCell className="text-right">{formatINR(a.cash)}</TableCell>
                      <TableCell className="text-right">{formatINR(a.tds)}</TableCell>
                      <TableCell className="text-right">{formatINR(a.gross)}</TableCell>
                      <TableCell>{status}</TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/app/sales/invoices/${inv.id}`}>View</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                      );
                    })()
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
