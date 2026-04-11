import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";

import { ApprovalStatusControl } from "@/components/app/approval-status-control";
import { ModuleCheatSheet } from "@/components/help/module-cheat-sheet";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatINR } from "@/lib/money";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

import { deleteReceipt } from "../actions";
import { ReceiptEditForm } from "./receipt-edit-form";

function dateOnly(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function ReceiptDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const { id } = await params;

  const receipt = await prisma.receipt.findFirst({
    where: { tenantId: session.user.tenantId, id },
    include: {
      clientInvoice: {
        select: {
          id: true,
          invoiceNumber: true,
          projectId: true,
          project: { select: { name: true } },
          client: { select: { name: true } },
        },
      },
    },
  });
  if (!receipt) return null;

  const stages = await prisma.projectPaymentStage.findMany({
    where: { tenantId: session.user.tenantId, projectId: receipt.clientInvoice.projectId },
    orderBy: [{ sortOrder: "asc" }, { stageName: "asc" }],
    select: { id: true, stageName: true },
  });

  const cash = Number(receipt.amountReceived);
  const tds = Number(receipt.tdsAmount ?? 0);
  const gross = cash + tds;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Receipt</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {receipt.clientInvoice.client.name} • {receipt.clientInvoice.invoiceNumber} • {dateOnly(receipt.date)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/app/sales/receipts">Back</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href={`/app/sales/invoices/${receipt.clientInvoice.id}`}>Open invoice</Link>
          </Button>
          <form
            action={async () => {
              "use server";
              await deleteReceipt(receipt.id, receipt.clientInvoice.id);
              redirect("/app/sales/receipts");
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
            <CardTitle className="text-sm text-muted-foreground">Cash received</CardTitle>
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

      <Card>
        <CardHeader>
          <CardTitle>Review Status</CardTitle>
        </CardHeader>
        <CardContent>
          <ApprovalStatusControl target="receipt" id={receipt.id} status={receipt.approvalStatus} showHelp />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Edit</CardTitle>
              </CardHeader>
              <CardContent>
                <ReceiptEditForm
                  receipt={{
                    id: receipt.id,
                    clientInvoiceId: receipt.clientInvoiceId,
                    projectId: receipt.clientInvoice.projectId,
                    date: dateOnly(receipt.date),
                    amountReceived: Number(receipt.amountReceived).toFixed(2),
                    mode: receipt.mode,
                    channel: receipt.channel === "CASH" ? "CASH" : "BANK",
                    projectPaymentStageId: receipt.projectPaymentStageId ?? null,
                    reference: receipt.reference ?? null,
                    tdsDeducted: receipt.tdsDeducted,
                    tdsAmount: Number(receipt.tdsAmount ?? 0).toFixed(2),
                    remarks: receipt.remarks ?? null,
                  }}
                  stages={stages}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Invoice</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="text-muted-foreground">Project</div>
                  <div className="text-right font-medium">{receipt.clientInvoice.project.name}</div>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <div className="text-muted-foreground">Client</div>
                  <div className="text-right font-medium">{receipt.clientInvoice.client.name}</div>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <div className="text-muted-foreground">Invoice #</div>
                  <div className="text-right font-medium">{receipt.clientInvoice.invoiceNumber}</div>
                </div>
                <div className="pt-2">
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/app/sales/invoices/${receipt.clientInvoice.id}`}>Open invoice</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <ModuleCheatSheet moduleKey="receipts" variant="sidebar" showRoutingTrigger className="order-first lg:order-none" />
      </div>
    </div>
  );
}
