import Link from "next/link";
import { getServerSession } from "next-auth/next";

import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

function statusVariant(status: string): "outline" | "secondary" | "default" | "destructive" {
  if (status === "CANCELLED") return "destructive";
  if (status === "FULLY_BILLED") return "default";
  if (status === "PARTIALLY_BILLED") return "secondary";
  return "outline";
}

function statusLabel(status: string) {
  return status.replace(/_/g, " ");
}

function formatINR(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

export default async function PurchaseOrdersPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const orders = await prisma.purchaseOrder.findMany({
    where: { tenantId: session.user.tenantId },
    orderBy: [{ orderDate: "desc" }, { createdAt: "desc" }],
    take: 200,
    include: {
      vendor: { select: { name: true } },
      project: { select: { name: true } },
      lines: { select: { amount: true } },
      purchaseInvoices: { select: { id: true } },
    },
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <PageHeader
        eyebrow="Purchases"
        title="Purchase Orders"
        description="Raise POs to vendors before work begins. Link bills to POs for 3-way matching."
        actions={
          <Button asChild>
            <Link href="/app/purchases/orders/new">New PO</Link>
          </Button>
        }
      />

      <div className="overflow-x-auto rounded-[18px] border border-border/60">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>PO Number</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Project</TableHead>
              <TableHead className="text-right">PO Value</TableHead>
              <TableHead>Bills</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => {
              const total = order.lines.reduce((sum, l) => sum + Number(l.amount), 0);
              return (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">{order.orderNumber}</TableCell>
                  <TableCell>{order.orderDate.toISOString().slice(0, 10)}</TableCell>
                  <TableCell>{order.vendor.name}</TableCell>
                  <TableCell className="text-muted-foreground">{order.project.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatINR(total)}</TableCell>
                  <TableCell>{order.purchaseInvoices.length}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(order.status)}>{statusLabel(order.status)}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/app/purchases/orders/${order.id}`}>Open</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center text-sm text-muted-foreground">
                  No purchase orders yet. Create your first PO to start tracking vendor commitments.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
