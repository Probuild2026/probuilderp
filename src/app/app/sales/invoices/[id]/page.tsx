import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatINR } from "@/lib/money";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

import { deleteClientInvoice, updateClientInvoice } from "../actions";
import { createReceipt, deleteReceipt } from "../../receipts/actions";
import { InvoiceForm } from "../ui/invoice-form";
import { ReceiptForm } from "../ui/receipt-form";

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const { id } = await params;

  const [invoice, profile, receipts] = await Promise.all([
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
        receivedAmount: true,
        status: true,
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
  ]);

  if (!invoice) return notFound();

  const invoiceId = invoice.id;

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
    status: invoice.status,
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
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Invoice {invoice.invoiceNumber}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {invoice.client.name} · {invoice.project.name}
            {profile?.legalName ? ` · ${profile.legalName}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/app/sales/invoices">Back</Link>
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
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Totals</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <div className="text-xs text-muted-foreground">Basic</div>
              <div className="text-lg font-semibold">{formatINR(Number(invoice.basicValue))}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">GST</div>
              <div className="text-lg font-semibold">
                {formatINR(Number(invoice.cgst) + Number(invoice.sgst) + Number(invoice.igst))}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Total</div>
              <div className="text-lg font-semibold">{formatINR(Number(invoice.total))}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Received</div>
              <div className="text-lg font-semibold">{formatINR(Number(invoice.receivedAmount))}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status</span>
              <span className="font-medium">{invoice.status}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Invoice date</span>
              <span className="font-medium">{invoice.invoiceDate.toISOString().slice(0, 10)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Due date</span>
              <span className="font-medium">{invoice.dueDate ? invoice.dueDate.toISOString().slice(0, 10) : "—"}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Edit invoice</CardTitle>
            </CardHeader>
            <CardContent>
              <InvoiceForm
                today={new Date().toISOString().slice(0, 10)}
                projects={projects}
                clients={clients}
                defaultValues={defaults}
                submitLabel="Save invoice"
                onSubmit={onUpdate}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Add receipt</CardTitle>
            </CardHeader>
            <CardContent>
              <ReceiptForm
                invoiceId={invoiceId}
                invoiceTotal={Number(invoice.total)}
                invoiceReceived={Number(invoice.receivedAmount)}
                onSubmit={async (fd) => {
                  "use server";
                  await createReceipt(fd);
                  redirect(`/app/sales/invoices/${invoiceId}`);
                }}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Receipts</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Received</TableHead>
                      <TableHead className="text-right">TDS</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead>Ref</TableHead>
                      <TableHead className="text-right">Delete</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {receipts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                          No receipts yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      receipts.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>{r.date.toISOString().slice(0, 10)}</TableCell>
                          <TableCell className="text-right">{formatINR(Number(r.amountReceived))}</TableCell>
                          <TableCell className="text-right">{formatINR(Number(r.tdsAmount ?? 0))}</TableCell>
                          <TableCell>{r.mode}</TableCell>
                          <TableCell className="max-w-[160px] truncate">{r.reference ?? "—"}</TableCell>
                          <TableCell className="text-right">
                            <form
                              action={async () => {
                                "use server";
                                await deleteReceipt(r.id, invoiceId);
                                redirect(`/app/sales/invoices/${invoiceId}`);
                              }}
                            >
                              <Button type="submit" variant="destructive" size="sm">
                                Delete
                              </Button>
                            </form>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              <Separator />
              <div className="p-4 text-xs text-muted-foreground">
                Tip: Client TDS is added to “effective received” for status, but “Received” shows actual money you got.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
