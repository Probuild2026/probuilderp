import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";

import { deleteVendorPayment } from "@/app/actions/vendor-payments";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatINR } from "@/lib/money";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

import { PaymentEditForm } from "./payment-edit-form";

function dateOnly(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function VendorPaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const { id } = await params;

  const payment = await prisma.transaction.findFirst({
    where: { tenantId: session.user.tenantId, id, type: "EXPENSE", vendorId: { not: null } },
    include: {
      vendor: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
    },
  });
  if (!payment) return null;

  const allocations = await prisma.transactionAllocation.findMany({
    where: { tenantId: session.user.tenantId, transactionId: payment.id, documentType: "PURCHASE_INVOICE" },
    orderBy: { createdAt: "asc" },
  });

  const invoiceIds = [...new Set(allocations.map((a) => a.documentId))];
  const invoices = invoiceIds.length
    ? await prisma.purchaseInvoice.findMany({
        where: { tenantId: session.user.tenantId, id: { in: invoiceIds } },
        select: { id: true, invoiceNumber: true, invoiceDate: true, total: true },
      })
    : [];
  const invoiceById = new Map(invoices.map((i) => [i.id, i]));

  const cash = Number(payment.amount);
  const tds = Number(payment.tdsAmount ?? 0);
  const gross = cash + tds;

  const projects = await prisma.project.findMany({
    where: { tenantId: session.user.tenantId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Vendor payment</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {payment.vendor?.name ?? "Vendor"} • {dateOnly(payment.date)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/app/purchases/payments-made">Back</Link>
          </Button>
          <form
            action={async () => {
              "use server";
              await deleteVendorPayment(payment.id);
              redirect("/app/purchases/payments-made");
            }}
          >
            <Button variant="destructive" type="submit">
              Delete
            </Button>
          </form>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Cash paid</CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-semibold tabular-nums">{formatINR(cash)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">TDS</CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-semibold tabular-nums">{formatINR(tds)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Gross</CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-semibold tabular-nums">{formatINR(gross)}</CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Edit</CardTitle>
          </CardHeader>
          <CardContent>
            <PaymentEditForm
              payment={{
                id: payment.id,
                date: dateOnly(payment.date),
                mode: (payment.mode ?? "BANK_TRANSFER") as any,
                projectId: payment.projectId ?? null,
                reference: payment.reference ?? null,
                note: payment.note ?? null,
                description: payment.description ?? null,
              }}
              projects={projects}
            />
            <div className="mt-4 text-xs text-muted-foreground">
              Amounts/TDS are computed by the Vendor Payments flow. To change vendor mapping, use Vendors → Merge vendors.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bills applied</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {allocations.length === 0 ? (
              <div className="text-sm text-muted-foreground">No bills linked (lump-sum subcontractor payment).</div>
            ) : (
              <div className="space-y-2">
                {allocations.map((a) => {
                  const inv = invoiceById.get(a.documentId);
                  const rowCash = Number(a.cashAmount);
                  const rowTds = Number(a.tdsAmount);
                  const rowGross = Number(a.grossAmount);
                  return (
                    <div key={a.id} className="rounded-md border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{inv?.invoiceNumber ?? "Bill"}</div>
                          <div className="text-xs text-muted-foreground">
                            {inv?.invoiceDate ? dateOnly(inv.invoiceDate) : "—"}
                          </div>
                        </div>
                        <div className="text-right text-sm tabular-nums">
                          <div>{formatINR(rowGross)}</div>
                          <div className="text-xs text-muted-foreground">
                            Cash {formatINR(rowCash)} • TDS {formatINR(rowTds)}
                          </div>
                        </div>
                      </div>
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

