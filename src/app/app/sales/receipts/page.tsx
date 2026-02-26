import Link from "next/link";
import { getServerSession } from "next-auth/next";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatINR } from "@/lib/money";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

export default async function ReceiptsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const receipts = await prisma.receipt.findMany({
    where: { tenantId: session.user.tenantId },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 200,
    select: {
      id: true,
      date: true,
      amountReceived: true,
      mode: true,
      tdsAmount: true,
      clientInvoice: {
        select: {
          id: true,
          invoiceNumber: true,
          project: { select: { name: true } },
          client: { select: { name: true } },
        },
      },
    },
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Receipts</h1>
          <p className="mt-1 text-sm text-muted-foreground">Payments received against invoices (including TDS).</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/app/sales/invoices">Go to invoices</Link>
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
                  <TableHead className="text-right">Received</TableHead>
                  <TableHead className="text-right">TDS</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead className="text-right">Open</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receipts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                      No receipts yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  receipts.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.date.toISOString().slice(0, 10)}</TableCell>
                      <TableCell className="font-medium">{r.clientInvoice.invoiceNumber}</TableCell>
                      <TableCell className="max-w-[260px] truncate">{r.clientInvoice.project.name}</TableCell>
                      <TableCell className="max-w-[260px] truncate">{r.clientInvoice.client.name}</TableCell>
                      <TableCell className="text-right">{formatINR(Number(r.amountReceived))}</TableCell>
                      <TableCell className="text-right">{formatINR(Number(r.tdsAmount ?? 0))}</TableCell>
                      <TableCell>{r.mode}</TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/app/sales/invoices/${r.clientInvoice.id}`}>View</Link>
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
    </div>
  );
}

