import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";

import {
  DetailWorkspaceHeader,
  DetailWorkspacePanel,
  DetailWorkspaceStat,
  DetailWorkspaceStats,
} from "@/components/app/detail-workspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MODULE_CHEAT_SHEETS } from "@/config/module-cheat-sheets";
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
  const paidPct = totalValue > 0 ? Math.min(100, Math.round((settledGross / totalValue) * 100)) : 0;
  const lastReceiptDate = receipts[0]?.date ? receipts[0].date.toISOString().slice(0, 10) : null;
  const guide = MODULE_CHEAT_SHEETS.invoices;

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
        <div className="space-y-3">
          <DetailWorkspaceStats>
            <DetailWorkspaceStat label="Basic value" value={formatINR(basicValue)} />
            <DetailWorkspaceStat label="GST" value={formatINR(gstValue)} hint={`${invoice.gstType} · ${invoice.gstRate}%`} />
            <DetailWorkspaceStat
              label="Total invoice"
              value={formatINR(totalValue)}
              hint="Final amount billed"
            />
            <DetailWorkspaceStat
              label="Paid to date"
              value={formatINR(cashReceived)}
              hint={`Settled ${formatINR(settledGross)}`}
              className="border-emerald-200 bg-emerald-50/60"
            />
            <DetailWorkspaceStat
              label="Remaining balance"
              value={formatINR(outstanding)}
              hint={
                <span className="flex items-center gap-2">
                  <Badge variant="outline" className={statusTone(status)}>
                    {status}
                  </Badge>
                  <span>Due {invoice.dueDate ? invoice.dueDate.toISOString().slice(0, 10) : "Not set"}</span>
                </span>
              }
              className="border-amber-200 bg-amber-50/70"
            />
          </DetailWorkspaceStats>

          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span>{invoice.client.name}</span>
            <span className="hidden sm:inline">/</span>
            <span>{invoice.project.name}</span>
            <span className="hidden sm:inline">/</span>
            <span>Invoice date {invoice.invoiceDate.toISOString().slice(0, 10)}</span>
          </div>
        </div>
      </DetailWorkspaceHeader>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.85fr)] xl:items-start">
        <div className="space-y-6">
          <DetailWorkspacePanel
            title="Edit invoice"
            description="Update the invoice information and tax details. Changes stay pinned while you work through the form."
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
            title="Payment history"
            description="All receipts recorded against this invoice."
            actions={<Badge variant="secondary">{receipts.length} receipts</Badge>}
          >
            <Table className="min-w-[760px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky top-0 z-10 bg-background/95 backdrop-blur">Date</TableHead>
                  <TableHead className="sticky top-0 z-10 bg-background/95 text-right backdrop-blur">Amount received</TableHead>
                  <TableHead className="sticky top-0 z-10 bg-background/95 text-right backdrop-blur">TDS</TableHead>
                  <TableHead className="sticky top-0 z-10 bg-background/95 backdrop-blur">Mode</TableHead>
                  <TableHead className="sticky top-0 z-10 hidden bg-background/95 backdrop-blur md:table-cell">Reference</TableHead>
                  <TableHead className="sticky top-0 z-10 hidden bg-background/95 backdrop-blur lg:table-cell">Notes</TableHead>
                  <TableHead className="sticky top-0 z-10 bg-background/95 text-right backdrop-blur">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receipts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-14">
                      <div className="flex flex-col items-center gap-3 text-center">
                        <div className="space-y-1">
                          <div className="text-base font-medium">No payments have been recorded for this invoice yet.</div>
                          <div className="text-sm text-muted-foreground">
                            Record the first payment to start tracking collection progress.
                          </div>
                        </div>
                        <Button asChild size="sm">
                          <Link href="#record-receipt">Add first receipt</Link>
                        </Button>
                      </div>
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
                        <div className="flex justify-end gap-2">
                          <Button asChild type="button" variant="secondary" size="sm">
                            <Link href={`/app/sales/receipts/${r.id}`}>View</Link>
                          </Button>
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
                        </div>
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
            description="Record a payment received against this invoice. This payment will be applied to the outstanding balance."
            className="xl:sticky xl:top-6"
          >
            <div id="record-receipt" className="scroll-mt-24">
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
            </div>
          </DetailWorkspacePanel>

          <DetailWorkspacePanel
            title="Invoice snapshot"
            description="Quick financial context while you record receipts."
          >
            <div className="space-y-5">
              <div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <Badge variant="outline" className={statusTone(status)}>
                    {status}
                  </Badge>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${paidPct}%` }} />
                </div>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Payment progress</span>
                  <span className="font-medium">{paidPct}%</span>
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {formatINR(settledGross)} of {formatINR(totalValue)} received
                </div>
              </div>

              <Separator />

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
                  <span className="text-muted-foreground">Client</span>
                  <span className="font-medium">{invoice.client.name}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Project</span>
                  <span className="font-medium">{invoice.project.name}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Last receipt</span>
                  <span className="font-medium">{lastReceiptDate ?? "No receipts yet"}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">TDS settled</span>
                  <span className="font-medium">{formatINR(tdsSettled)}</span>
                </div>
              </div>
            </div>
          </DetailWorkspacePanel>
        </div>
      </div>

      <DetailWorkspacePanel
        title="Need help?"
        description="Reference guidance stays available, but collapsed until you need it."
      >
        <div className="space-y-3">
          <details className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-3">
            <summary className="cursor-pointer list-none text-sm font-medium">What belongs in invoices?</summary>
            <ul className="mt-3 space-y-2 pl-4 text-sm text-muted-foreground">
              {guide.useWhen.map((item) => (
                <li key={item} className="list-disc">
                  {item}
                </li>
              ))}
            </ul>
          </details>
          <details className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-3">
            <summary className="cursor-pointer list-none text-sm font-medium">When should I use this?</summary>
            <ul className="mt-3 space-y-2 pl-4 text-sm text-muted-foreground">
              {guide.doNotUseWhen.map((item) => (
                <li key={item} className="list-disc">
                  {item}
                </li>
              ))}
            </ul>
          </details>
          <details className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-3">
            <summary className="cursor-pointer list-none text-sm font-medium">Examples</summary>
            <ul className="mt-3 space-y-2 pl-4 text-sm text-muted-foreground">
              {guide.examples.map((item) => (
                <li key={item} className="list-disc">
                  {item}
                </li>
              ))}
            </ul>
          </details>
        </div>
      </DetailWorkspacePanel>
    </div>
  );
}
