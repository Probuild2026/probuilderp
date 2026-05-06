import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { notFound, redirect } from "next/navigation";

import { deletePurchaseInvoice } from "@/app/actions/purchase-invoices";
import { ApprovalStatusControl } from "@/components/app/approval-status-control";
import { ModuleCheatSheet } from "@/components/help/module-cheat-sheet";
import { InlineEmptyState, StatePanel } from "@/components/app/state-panels";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatINR } from "@/lib/money";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

import { BillEditForm } from "./bill-edit-form";
import { DeleteBillButton } from "./delete-bill-button";

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
      materialReceipts: {
        orderBy: [{ receiptDate: "desc" }, { createdAt: "desc" }],
        include: {
          item: { select: { name: true, unit: true } },
        },
      },
    },
  });
  if (!bill) notFound();

  const allocations = await prisma.transactionAllocation.findMany({
    where: { tenantId: session.user.tenantId, documentType: "PURCHASE_INVOICE", documentId: bill.id },
    orderBy: { createdAt: "asc" },
    select: { transactionId: true, cashAmount: true, tdsAmount: true, grossAmount: true, createdAt: true },
  });

  const txnIds = [...new Set(allocations.map((a) => a.transactionId))];
  const attachments = await prisma.attachment.findMany({
    where: { tenantId: session.user.tenantId, entityType: "PURCHASE_INVOICE", entityId: bill.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, originalName: true, mimeType: true },
  });
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
  const isSettled = balance === 0 && paid > 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Bill workspace</h1>
          <p className="mt-1 text-base font-medium text-foreground/80">
            {bill.vendor.name} • {bill.invoiceNumber} • {dateOnly(bill.invoiceDate)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/app/purchases/bills">Back</Link>
          </Button>
          <DeleteBillButton
            disabled={deleteDisabled}
            action={async () => {
              "use server";
              await deletePurchaseInvoice(bill.id);
              redirect("/app/purchases/bills");
            }}
          />
        </div>
      </div>
      {deleteDisabled ? (
        <StatePanel
          tone="warning"
          title="Delete disabled"
          description="This bill already has payments applied. Remove payment allocations first before deleting the bill."
        />
      ) : null}

      <section className="grid gap-4 lg:grid-cols-4">
        <MetricCard label="Bill total" value={formatINR(total)} />
        <MetricCard label="Payments recorded" value={formatINR(paid)} />
        <MetricCard label="Outstanding" value={formatINR(balance)} badge={isSettled ? "Settled" : undefined} />
        <MetricCard label="Deliveries linked" value={String(bill.materialReceipts.length)} />
      </section>

      <Card>
        <CardHeader className="border-b border-border/60">
          <CardTitle className="text-base">Review status</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <ApprovalStatusControl target="bill" id={bill.id} status={bill.approvalStatus} showHelp />
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_360px] xl:items-start">
        <div className="space-y-6">
          <Card>
            <CardHeader className="border-b border-border/60">
              <CardTitle className="text-base">Edit bill</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <BillEditForm
                tenantId={session.user.tenantId}
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b border-border/60">
              <CardTitle className="flex items-center justify-between gap-3 text-base">
                <span>Material deliveries</span>
                <Button asChild size="sm" variant="outline">
                  <Link href="/app/purchases/materials">Open materials</Link>
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-6">
              {bill.materialReceipts.length === 0 ? (
                <InlineEmptyState
                  title="No deliveries linked"
                  description="Link delivery challans to this bill from the material tracking page, or create the bill directly from an unbilled delivery."
                />
              ) : (
                bill.materialReceipts.map((receipt) => (
                  <div key={receipt.id} className="rounded-[18px] border border-border/60 bg-background/70 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{receipt.item.name}</div>
                        <div className="mt-1 truncate text-xs text-muted-foreground">
                          {dateOnly(receipt.receiptDate)} • Challan {receipt.challanNumber ?? "—"} • {receipt.stageName ?? "No stage"}
                        </div>
                      </div>
                      <div className="text-right text-sm font-semibold tabular-nums">
                        {Number(receipt.quantity).toLocaleString("en-IN", { maximumFractionDigits: 3 })}
                        {receipt.item.unit ? ` ${receipt.item.unit}` : ""}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="border-b border-border/60">
              <CardTitle className="text-base">Attachments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-6">
              {attachments.length === 0 ? (
                <InlineEmptyState
                  title="No bill files uploaded"
                  description="Attach PDFs or invoice photos when you need source backup for audit and payment verification."
                />
              ) : (
                attachments.map((attachment) => (
                  <div key={attachment.id} className="flex items-center justify-between gap-3 rounded-[18px] border border-border/60 bg-background/70 px-4 py-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{attachment.originalName}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{attachment.mimeType}</div>
                    </div>
                    <Button asChild size="sm" variant="outline">
                      <a href={`/api/attachments/${attachment.id}`} target="_blank" rel="noreferrer">
                        Open
                      </a>
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b border-border/60">
              <CardTitle className="flex items-center justify-between gap-3 text-base">
                <span>Payments applied</span>
                {balance > 0 ? (
                  <Button asChild size="sm" variant="outline">
                    <Link
                      href={`/app/purchases/payments-made/new?vendorId=${encodeURIComponent(
                        bill.vendorId,
                      )}&projectId=${encodeURIComponent(bill.projectId)}&billId=${encodeURIComponent(
                        bill.id,
                      )}&amount=${encodeURIComponent(balance.toFixed(2))}`}
                    >
                      Add payment
                    </Link>
                  </Button>
                ) : null}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-6">
              {allocations.length === 0 ? (
                <InlineEmptyState
                  title="No payments applied yet"
                  description="Use the vendor payment flow to settle this bill in full or in parts."
                />
              ) : (
                allocations.map((a, idx) => {
                  const t = txnById.get(a.transactionId);
                  const rowCash = Number(a.cashAmount);
                  const rowTds = Number(a.tdsAmount);
                  const rowGross = Number(a.grossAmount);
                  return (
                    <div key={`${a.transactionId}-${idx}`} className="rounded-[18px] border border-border/60 bg-background/70 p-4">
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
                        <div className="mt-3">
                          <Button asChild size="sm" variant="secondary">
                            <Link href={`/app/purchases/payments-made/${t.id}`}>Open payment</Link>
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          <ModuleCheatSheet moduleKey="bills" variant="sidebar" showRoutingTrigger />
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, badge }: { label: string; value: string; badge?: string }) {
  return (
    <Card className={badge ? "border-emerald-500/40 bg-emerald-500/5" : undefined}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>{label}</span>
          {badge ? <Badge variant="secondary">{badge}</Badge> : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-lg font-semibold tracking-tight [overflow-wrap:anywhere]">{value}</CardContent>
    </Card>
  );
}
