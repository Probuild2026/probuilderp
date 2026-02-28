import Link from "next/link";
import { getServerSession } from "next-auth/next";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatINR } from "@/lib/money";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

export default async function BillsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const bills = await prisma.purchaseInvoice.findMany({
    where: { tenantId: session.user.tenantId },
    orderBy: [{ invoiceDate: "desc" }, { createdAt: "desc" }],
    take: 200,
    select: {
      id: true,
      invoiceNumber: true,
      invoiceDate: true,
      total: true,
      taxableValue: true,
      vendor: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
    },
  });

  const paid = bills.length
    ? await prisma.transactionAllocation.groupBy({
        by: ["documentId"],
        where: {
          tenantId: session.user.tenantId,
          documentType: "PURCHASE_INVOICE",
          documentId: { in: bills.map((b) => b.id) },
        },
        _sum: { grossAmount: true },
      })
    : [];

  const paidById = new Map(paid.map((p) => [p.documentId, Number(p._sum.grossAmount ?? 0)]));

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Bills</h1>
          <p className="mt-1 text-sm text-muted-foreground">Vendor bills (purchase invoices). Payments are tracked separately.</p>
        </div>
        <Button asChild>
          <Link href="/app/purchases/bills/new">New Bill</Link>
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Bill #</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bills.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                      No bills yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  bills.map((b) => {
                    const total = Number(b.total);
                    const paidGross = paidById.get(b.id) ?? 0;
                    const balance = Math.max(0, total - paidGross);
                    return (
                      <TableRow key={b.id}>
                        <TableCell>{b.invoiceDate.toISOString().slice(0, 10)}</TableCell>
                        <TableCell className="font-medium">{b.invoiceNumber}</TableCell>
                        <TableCell className="max-w-[260px] truncate">{b.vendor.name}</TableCell>
                        <TableCell className="max-w-[260px] truncate">{b.project.name}</TableCell>
                        <TableCell className="text-right">{formatINR(total)}</TableCell>
                        <TableCell className="text-right">{formatINR(paidGross)}</TableCell>
                        <TableCell className="text-right">{formatINR(balance)}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

