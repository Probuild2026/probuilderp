import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { notFound, redirect } from "next/navigation";

import { deletePurchaseOrder, updatePurchaseOrderStatus } from "@/app/actions/purchase-orders";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

import { PoStatusControl } from "./po-status-control";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  PARTIALLY_BILLED: "Partially Billed",
  FULLY_BILLED: "Fully Billed",
  CANCELLED: "Cancelled",
};

function statusVariant(status: string): "outline" | "secondary" | "default" | "destructive" {
  if (status === "CANCELLED") return "destructive";
  if (status === "FULLY_BILLED") return "default";
  if (status === "PARTIALLY_BILLED") return "secondary";
  return "outline";
}

function formatINR(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);
}

export default async function PurchaseOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const { id } = await params;

  const order = await prisma.purchaseOrder.findFirst({
    where: { tenantId: session.user.tenantId, id },
    include: {
      vendor: { select: { name: true, phone: true, email: true } },
      project: { select: { name: true } },
      lines: { orderBy: { sortOrder: "asc" } },
      purchaseInvoices: {
        orderBy: { invoiceDate: "desc" },
        select: { id: true, invoiceNumber: true, invoiceDate: true, total: true, approvalStatus: true },
      },
    },
  });
  if (!order) notFound();

  const orderTotal = order.lines.reduce((sum, l) => sum + Number(l.amount), 0);
  const billedTotal = order.purchaseInvoices.reduce((sum, b) => sum + Number(b.total), 0);
  const openBalance = Math.max(0, orderTotal - billedTotal);
  const canDelete = order.purchaseInvoices.length === 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Purchases / Purchase Orders</p>
          <h1 className="mt-1 text-2xl font-semibold">{order.orderNumber}</h1>
          <p className="mt-1 text-base text-foreground/80">{order.vendor.name} • {order.project.name} • {order.orderDate.toISOString().slice(0, 10)}</p>
          <div className="mt-2">
            <Badge variant={statusVariant(order.status)}>{STATUS_LABELS[order.status] ?? order.status}</Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/app/purchases/orders">Back</Link>
          </Button>
          {canDelete ? (
            <form action={async () => {
              "use server";
              const result = await deletePurchaseOrder({ id: order.id });
              if (result.ok) redirect("/app/purchases/orders");
            }}>
              <Button type="submit" variant="destructive" size="sm">Delete PO</Button>
            </form>
          ) : null}
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          { label: "PO Value", value: formatINR(orderTotal) },
          { label: "Billed so far", value: formatINR(billedTotal) },
          { label: "Open balance", value: formatINR(openBalance) },
        ].map((m) => (
          <div key={m.label} className="rounded-[22px] border border-border/60 bg-card px-4 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{m.label}</div>
            <div className="mt-3 text-xl font-semibold tabular-nums">{m.value}</div>
          </div>
        ))}
      </section>

      <PoStatusControl orderId={order.id} currentStatus={order.status} />

      <Card>
        <CardHeader className="border-b border-border/60">
          <CardTitle className="text-base">Line items</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.lines.map((line, idx) => (
                <TableRow key={line.id}>
                  <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                  <TableCell className="font-medium">{line.description}</TableCell>
                  <TableCell>{line.unit ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{Number(line.quantity).toFixed(3)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatINR(Number(line.rate))}</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">{formatINR(Number(line.amount))}</TableCell>
                </TableRow>
              ))}
              <TableRow className="border-t-2">
                <TableCell colSpan={5} className="text-right font-semibold">Total</TableCell>
                <TableCell className="text-right tabular-nums font-semibold">{formatINR(orderTotal)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {order.notes ? (
        <div className="rounded-[18px] border border-border/60 bg-muted/20 px-4 py-3 text-sm">
          <span className="font-semibold">Notes: </span>{order.notes}
        </div>
      ) : null}

      <Card>
        <CardHeader className="border-b border-border/60">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">Bills linked to this PO ({order.purchaseInvoices.length})</CardTitle>
            <Button asChild size="sm" variant="outline">
              <Link href={`/app/purchases/bills/new?purchaseOrderId=${order.id}`}>Create bill from PO</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {order.purchaseInvoices.length === 0 ? (
            <div className="px-4 py-6 text-sm text-muted-foreground">No bills linked yet. Create a bill and link this PO to track what&apos;s been invoiced.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.purchaseInvoices.map((bill) => (
                  <TableRow key={bill.id}>
                    <TableCell className="font-medium">{bill.invoiceNumber}</TableCell>
                    <TableCell>{bill.invoiceDate.toISOString().slice(0, 10)}</TableCell>
                    <TableCell><Badge variant="outline">{bill.approvalStatus}</Badge></TableCell>
                    <TableCell className="text-right tabular-nums">{formatINR(Number(bill.total))}</TableCell>
                    <TableCell>
                      <Button asChild size="sm" variant="ghost">
                        <Link href={`/app/purchases/bills/${bill.id}`}>Open</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
