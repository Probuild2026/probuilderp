import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";

import {
  DetailWorkspaceHeader,
  DetailWorkspacePanel,
  DetailWorkspaceStat,
  DetailWorkspaceStats,
} from "@/components/app/detail-workspace";
import { ModuleCheatSheet } from "@/components/help/module-cheat-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatINR } from "@/lib/money";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

import { createReceipt, deleteReceipt } from "../../receipts/actions";
import { deleteClientInvoice, updateClientInvoice } from "../actions";
import { InvoiceForm } from "../ui/invoice-form";
import { ReceiptForm } from "../ui/receipt-form";

function statusFromSettled(total: number, settled: number) {
  if (settled >= total) return "PAID";
  if (settled > 0) return "PARTIAL";
  return "DUE";
}

function statusTone(status: string) {
  switch (status) {
    case "PAID":
      return "bg-emerald-500/12 text-emerald-700 ring-1 ring-emerald-500/20";
    case "PARTIAL":
      return "bg-amber-500/12 text-amber-700 ring-1 ring-amber-500/20";
    default:
      return "bg-slate-500/10 text-slate-700 ring-1 ring-slate-500/20";
  }
}

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const { id } = await params;

  const [invoice, profile, receipts, alloc] = await Promise.all([
    prisma.clientInvoice.findFirst({
      where: { id, tenantId: session.user.tenantId },
      select: {
        id: true,
        projectId: true,
        clientId: true,
        invoiceNumber: true,
        invoiceDate: true,
        dueDate: true,
        serviceDescription: true,
        sacCode: true,
        gstType: true,
        gstRate: true,
        basicValue: true,
        cgst: true,
        sgst: true,
        igst: true,
        total: true,
        tdsRate: true,
        tdsAmountExpected: true,
        project: { select: { name: true } },
        client: { select: { name: true } },
      },
    }),
    prisma.tenantProfile.findUnique({
      where: { tenantId: session.user.tenantId },
      select: { legalName: true, logoUrl: true, gstin: true, pan: true },
    }),
    prisma.receipt.findMany({
      where: { tenantId: session.user.tenantId, clientInvoiceId: id },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        date: true,
        amountReceived: true,
        mode: true,
        reference: true,
        tdsDeducted: true,
        tdsAmount: true,
        remarks: true,
      },
    }),
    prisma.transactionAllocation.aggregate({
      where: { tenantId: session.user.tenantId, documentType: "CLIENT_INVOICE", documentId: id },
      _sum: { cashAmount: true, tdsAmount: true, grossAmount: true },
    }),
  ]);

  if (!invoice) return notFound();

  const invoiceId = invoice.id;
  const basicValue = Number(invoice.basicValue);
  const gstValue = Number(invoice.cgst) + Number(invoice.sgst) + Number(invoice.igst);
  const totalValue = Number(invoice.total);
  const cashReceived = Number(alloc._sum.cashAmount ?? 0);
  const tdsSettled = Number(alloc._sum.tdsAmount ?? 0);
  const settledGross = Number(alloc._sum.grossAmount ?? 0);
  const outstanding = Math.max(0, totalValue - settledGross);
  const status = statusFromSettled(totalValue, settledGross);

  const projects = await prisma.project.findMany({
    where: { tenantId: session.user.tenantId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const clients = await prisma.client.findMany({
    where: { tenantId: session.user.tenantId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const defaults: Record<string, string> = {
    id: invoice.id,
    projectId: invoice.projectId,
    clientId: invoice.clientId,
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: invoice.invoiceDate.toISOString().slice(0, 10),
    dueDate: invoice.dueDate ? invoice.dueDate.toISOString().slice(0, 10) : "",
    serviceDescription: invoice.serviceDescription ?? "",
    sacCode: invoice.sacCode ?? "",
    gstType: invoice.gstType,
    gstRate: invoice.gstRate ? String(invoice.gstRate) : "",
    basicValue: String(invoice.basicValue),
    tdsRate: invoice.tdsRate ? String(invoice.tdsRate) : "",
    tdsAmountExpected: invoice.tdsAmountExpected ? String(invoice.tdsAmountExpected) : "",
    status,
  };

  async function onUpdate(fd: FormData) {
    "use server";
    fd.set("id", invoiceId);
    await updateClientInvoice(fd);
    redirect(`/app/sales/invoices/${invoiceId}`);
  }

  async function onDelete() {
    "use server";
    await deleteClientInvoice(invoiceId);
    redirect("/app/sales/invoices");
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <DetailWorkspaceHeader
        eyebrow="Sales / Invoices"
        title={`Invoice ${invoice.invoiceNumber}`}
        description={
          <>
            {invoice.client.name} for {invoice.project.name}
            {profile?.legalName ? ` · ${profile.legalName}` : ""}
          </>
        }
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/app/sales/invoices">Back to invoices</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/app/sales/invoices/${invoiceId}/print`} target="_blank">
                Print / PDF
              </Link>
            </Button>
            <form action={onDelete}>
              <Button type="submit" variant="destructive">
                Delete
              </Button>
            </form>
          </>
        }
      >
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
          <DetailWorkspaceStats>
            <DetailWorkspaceStat label="Basic value" value={formatINR(basicValue)} />
            <DetailWorkspaceStat label="GST" value={formatINR(gstValue)} hint={`${invoice.gstType} · ${invoice.gstRate}%`} />
            <DetailWorkspaceStat label="Cash received" value={formatINR(cashReceived)} />
            <DetailWorkspaceStat label="Outstanding" value={formatINR(outstanding)} hint={`Settled total ${formatINR(settledGross)}`} />
          </DetailWorkspaceStats>

          <div className="rounded-2xl border border-border/60 bg-background/80 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Status</div>
                <div className="mt-2 text-lg font-semibold tracking-tight">{status}</div>
              </div>
              <Badge variant="outline" className={statusTone(status)}>
                {status}
              </Badge>
            </div>
            <Separator className="my-4" />
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Invoice date</span>
                <span className="font-medium">{invoice.invoiceDate.toISOString().slice(0, 10)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Due date</span>
                <span className="font-medium">{invoice.dueDate ? invoice.dueDate.toISOString().slice(0, 10) : "—"}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Receipt entries</span>
                <span className="font-medium">{receipts.length}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">TDS settled</span>
                <span className="font-medium">{formatINR(tdsSettled)}</span>
              </div>
            </div>
          </div>
        </div>
      </DetailWorkspaceHeader>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.85fr)] xl:items-start">
        <div className="space-y-6">
          <DetailWorkspacePanel
            title="Invoice details"
            description="Keep the billing party, timing, and tax values in one place. This panel is designed to scale to similar edit pages without nesting extra cards."
          >
            <InvoiceForm
              today={new Date().toISOString().slice(0, 10)}
              projects={projects}
              clients={clients}
              defaultValues={defaults}
              submitLabel="Save invoice"
              onSubmit={onUpdate}
            />
          </DetailWorkspacePanel>

          <DetailWorkspacePanel
            title="Receipts ledger"
            description="Track every collection against the invoice, including client-side TDS deductions."
            actions={<Badge variant="secondary">{receipts.length} receipts</Badge>}
          >
            <Table className="min-w-[720px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Received</TableHead>
                  <TableHead className="text-right">TDS</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead className="hidden md:table-cell">Reference</TableHead>
                  <TableHead className="hidden lg:table-cell">Notes</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receipts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                      No receipts posted for this invoice yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  receipts.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap">{r.date.toISOString().slice(0, 10)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatINR(Number(r.amountReceived))}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatINR(Number(r.tdsAmount ?? 0))}</TableCell>
                      <TableCell>{r.mode}</TableCell>
                      <TableCell className="hidden max-w-[180px] truncate md:table-cell">{r.reference ?? "—"}</TableCell>
                      <TableCell className="hidden max-w-[220px] truncate lg:table-cell">{r.remarks ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        <form
                          action={async () => {
                            "use server";
                            await deleteReceipt(r.id, invoiceId);
                            redirect(`/app/sales/invoices/${invoiceId}`);
                          }}
                        >
                          <Button type="submit" variant="outline" size="sm">
                            Remove
                          </Button>
                        </form>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <Separator className="my-4" />
            <p className="text-xs text-muted-foreground">
              Status uses gross settlement, so client TDS counts toward progress even when cash received is lower.
            </p>
          </DetailWorkspacePanel>
        </div>

        <div className="space-y-6">
          <DetailWorkspacePanel
            title="Record receipt"
            description="Add the next collection without leaving the invoice. Keep this on the side so the edit form has room to breathe."
          >
            <ReceiptForm
              invoiceId={invoiceId}
              invoiceTotal={totalValue}
              invoiceSettled={settledGross}
              onSubmit={async (fd) => {
                "use server";
                await createReceipt(fd);
                redirect(`/app/sales/invoices/${invoiceId}`);
              }}
            />
          </DetailWorkspacePanel>

          <DetailWorkspacePanel
            title="Posting guide"
            description="Reference notes stay available, but they no longer compete visually with the working form."
          >
            <ModuleCheatSheet moduleKey="invoices" variant="embedded" showRoutingTrigger />
          </DetailWorkspacePanel>
        </div>
      </div>
    </div>
  );
}
