import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";

import { deletePurchaseInvoice } from "@/app/actions/purchase-invoices";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatINR } from "@/lib/money";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

import { BillEditForm } from "./bill-edit-form";

function dateOnly(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function BillDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const { id } = await params;

  const bill = await prisma.purchaseInvoice.findFirst({
    where: { tenantId: session.user.tenantId, id },
    include: {
      vendor: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
    },
  });
  if (!bill) return null;

  const allocations = await prisma.transactionAllocation.findMany({
    where: { tenantId: session.user.tenantId, documentType: "PURCHASE_INVOICE", documentId: bill.id },
    orderBy: { createdAt: "asc" },
    select: { transactionId: true, cashAmount: true, tdsAmount: true, grossAmount: true, createdAt: true },
  });

  const txnIds = [...new Set(allocations.map((a) => a.transactionId))];
  const txns = txnIds.length
    ? await prisma.transaction.findMany({
        where: { tenantId: session.user.tenantId, id: { in: txnIds } },
        select: { id: true, date: true, mode: true, reference: true, amount: true, tdsAmount: true },
      })
    : [];
  const txnById = new Map(txns.map((t) => [t.id, t]));

  const total = Number(bill.total);
  const paid = allocations.reduce((acc, a) => acc + Number(a.grossAmount), 0);
  const balance = Math.max(0, total - paid);

  const [projects, vendors] = await Promise.all([
    prisma.project.findMany({
      where: { tenantId: session.user.tenantId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
      take: 500,
    }),
    prisma.vendor.findMany({
      where: { tenantId: session.user.tenantId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
      take: 500,
    }),
  ]);

  const deleteDisabled = allocations.length > 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Bill</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {bill.vendor.name} • {bill.invoiceNumber} • {dateOnly(bill.invoiceDate)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/app/purchases/bills">Back</Link>
          </Button>
          <form
            action={async () => {
              "use server";
              await deletePurchaseInvoice(bill.id);
              redirect("/app/purchases/bills");
            }}
          >
            <Button variant="destructive" type="submit" disabled={deleteDisabled} title={deleteDisabled ? "Remove payments before deleting." : ""}>
              Delete
            </Button>
          </form>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total</CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-semibold tabular-nums">{formatINR(total)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Paid</CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-semibold tabular-nums">{formatINR(paid)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Balance</CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-semibold tabular-nums">{formatINR(balance)}</CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Edit</CardTitle>
          </CardHeader>
          <CardContent>
            <BillEditForm
              bill={{
                id: bill.id,
                vendorId: bill.vendorId,
                projectId: bill.projectId,
                invoiceNumber: bill.invoiceNumber,
                invoiceDate: dateOnly(bill.invoiceDate),
                gstType: bill.gstType,
                taxableValue: Number(bill.taxableValue).toFixed(2),
                cgst: Number(bill.cgst).toFixed(2),
                sgst: Number(bill.sgst).toFixed(2),
                igst: Number(bill.igst).toFixed(2),
                total: Number(bill.total).toFixed(2),
              }}
              projects={projects}
              vendors={vendors}
            />
            {deleteDisabled ? (
              <div className="mt-3 text-xs text-muted-foreground">
                Delete is disabled because this bill has payments applied. Remove the payment allocations first (Payments Made → open payment).
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payments applied</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {allocations.length === 0 ? (
              <div className="text-sm text-muted-foreground">No payments applied yet.</div>
            ) : (
              <div className="space-y-2">
                {allocations.map((a, idx) => {
                  const t = txnById.get(a.transactionId);
                  const rowCash = Number(a.cashAmount);
                  const rowTds = Number(a.tdsAmount);
                  const rowGross = Number(a.grossAmount);
                  return (
                    <div key={`${a.transactionId}-${idx}`} className="rounded-md border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{t ? dateOnly(t.date) : "Payment"}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {t?.mode ?? "—"} • {t?.reference ?? "—"}
                          </div>
                        </div>
                        <div className="text-right text-sm tabular-nums">
                          <div>{formatINR(rowGross)}</div>
                          <div className="text-xs text-muted-foreground">
                            Cash {formatINR(rowCash)} • TDS {formatINR(rowTds)}
                          </div>
                        </div>
                      </div>
                      {t ? (
                        <div className="mt-2">
                          <Button asChild size="sm" variant="secondary">
                            <Link href={`/app/purchases/payments-made/${t.id}`}>Open payment</Link>
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

