import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { notFound, redirect } from "next/navigation";

import { deleteVendorPayment } from "@/app/actions/vendor-payments";
import { ApprovalStatusControl } from "@/components/app/approval-status-control";
import { ModuleCheatSheet } from "@/components/help/module-cheat-sheet";
import { InlineEmptyState } from "@/components/app/state-panels";
import { Badge } from "@/components/ui/badge";
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
  if (!payment) notFound();

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
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Vendor payment workspace</h1>
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

      <section className="grid gap-4 lg:grid-cols-4">
        <MetricCard label="Cash paid" value={formatINR(cash)} />
        <MetricCard label="TDS" value={formatINR(tds)} />
        <MetricCard label="Gross" value={formatINR(gross)} />
        <MetricCard label="Project" value={payment.project?.name ?? "Not linked"} />
      </section>

      <Card>
        <CardHeader className="border-b border-border/60">
          <CardTitle className="text-base">Review status</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <ApprovalStatusControl target="payment" id={payment.id} status={payment.approvalStatus} showHelp />
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_360px] xl:items-start">
        <div className="space-y-6">
          <Card>
            <CardHeader className="border-b border-border/60">
              <CardTitle className="text-base">Edit payment</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <PaymentEditForm
                payment={{
                  id: payment.id,
                  date: dateOnly(payment.date),
                  mode: payment.mode ?? "BANK_TRANSFER",
                  projectId: payment.projectId ?? null,
                  reference: payment.reference ?? null,
                  note: payment.note ?? null,
                  description: payment.description ?? null,
                  tdsSection: payment.tdsSection ?? null,
                  tdsDepositStatus: payment.tdsDepositStatus,
                  tdsChallanCin: payment.tdsChallanCin ?? null,
                  tdsChallanBsrCode: payment.tdsChallanBsrCode ?? null,
                  tdsChallanNumber: payment.tdsChallanNumber ?? null,
                  tdsChallanDate: payment.tdsChallanDate ? dateOnly(payment.tdsChallanDate) : null,
                }}
                projects={projects}
              />
              <div className="mt-4 text-xs text-muted-foreground">
                Amounts and TDS are computed by the vendor payment flow. To change vendor mapping, use Vendors → Merge vendors.
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="border-b border-border/60">
              <CardTitle className="flex items-center justify-between gap-3 text-base">
                <span>TDS challan</span>
                {tds > 0 ? (
                  <Badge variant={payment.tdsDepositStatus === "DEPOSITED" ? "default" : "secondary"}>
                    {payment.tdsDepositStatus === "DEPOSITED" ? "Deposited" : "Pending"}
                  </Badge>
                ) : null}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-6 text-sm">
              {tds <= 0 ? (
                <InlineEmptyState title="No TDS deducted" description="Challan details are only needed when TDS is withheld on this payment." />
              ) : (
                <>
                  <DetailRow label="Section" value={payment.tdsSection ?? "194C"} />
                  <DetailRow label="CIN" value={payment.tdsChallanCin ?? "—"} />
                  <DetailRow label="BSR code" value={payment.tdsChallanBsrCode ?? "—"} />
                  <DetailRow label="Challan no." value={payment.tdsChallanNumber ?? "—"} />
                  <DetailRow label="Date of deposit" value={payment.tdsChallanDate ? dateOnly(payment.tdsChallanDate) : "—"} />
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b border-border/60">
              <CardTitle className="text-base">Bills applied</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-6">
              {allocations.length === 0 ? (
                <InlineEmptyState
                  title="No bills linked"
                  description="This payment stands alone right now, which is valid for lump-sum subcontractor or advance settlements."
                />
              ) : (
                allocations.map((a) => {
                  const inv = invoiceById.get(a.documentId);
                  const rowCash = Number(a.cashAmount);
                  const rowTds = Number(a.tdsAmount);
                  const rowGross = Number(a.grossAmount);
                  return (
                    <div key={a.id} className="rounded-[18px] border border-border/60 bg-background/70 p-4">
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
                      {inv ? (
                        <div className="mt-3">
                          <Button asChild size="sm" variant="secondary">
                            <Link href={`/app/purchases/bills/${inv.id}`}>Open bill</Link>
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          <ModuleCheatSheet moduleKey="paymentsMade" variant="sidebar" showRoutingTrigger />
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="text-lg font-semibold tracking-tight [overflow-wrap:anywhere]">{value}</CardContent>
    </Card>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
