"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

function parseDateOnly(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid date");
  return date;
}

export async function createReceipt(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const clientInvoiceId = String(formData.get("clientInvoiceId") ?? "");
  const date = String(formData.get("date") ?? "");
  const amountReceived = Number(formData.get("amountReceived") ?? 0);
  const mode = String(formData.get("mode") ?? "") as any;
  const reference = String(formData.get("reference") ?? "").trim();
  const tdsDeducted = String(formData.get("tdsDeducted") ?? "") === "1";
  const tdsAmount = tdsDeducted ? Number(formData.get("tdsAmount") ?? 0) : null;
  const remarks = String(formData.get("remarks") ?? "").trim();

  if (!clientInvoiceId) throw new Error("Invoice is required.");
  if (!date) throw new Error("Date is required.");
  if (!Number.isFinite(amountReceived) || amountReceived <= 0) throw new Error("Amount must be > 0.");
  if (!mode) throw new Error("Mode is required.");

  await prisma.$transaction(async (tx) => {
    const invoice = await tx.clientInvoice.findFirst({
      where: { id: clientInvoiceId, tenantId: session.user.tenantId },
      select: { id: true, total: true },
    });
    if (!invoice) throw new Error("Invoice not found.");

    await tx.receipt.create({
      data: {
        tenantId: session.user.tenantId,
        clientInvoiceId,
        date: parseDateOnly(date),
        amountReceived,
        mode,
        reference: reference || null,
        tdsDeducted,
        tdsAmount: tdsAmount && Number.isFinite(tdsAmount) ? tdsAmount : null,
        remarks: remarks || null,
      },
    });

    const sums = await tx.receipt.aggregate({
      where: { tenantId: session.user.tenantId, clientInvoiceId },
      _sum: { amountReceived: true, tdsAmount: true },
    });

    const received = Number(sums._sum.amountReceived ?? 0);
    const tds = Number(sums._sum.tdsAmount ?? 0);
    const effective = received + tds;

    const status = effective >= Number(invoice.total) ? "PAID" : effective > 0 ? "PARTIAL" : "DUE";

    await tx.clientInvoice.update({
      where: { id: clientInvoiceId, tenantId: session.user.tenantId },
      data: { receivedAmount: received, status },
    });
  });

  revalidatePath(`/app/sales/invoices/${clientInvoiceId}`);
  revalidatePath("/app/sales/receipts");
}

export async function deleteReceipt(id: string, clientInvoiceId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  await prisma.$transaction(async (tx) => {
    await tx.receipt.delete({
      where: { id, tenantId: session.user.tenantId },
    });

    const invoice = await tx.clientInvoice.findFirst({
      where: { id: clientInvoiceId, tenantId: session.user.tenantId },
      select: { id: true, total: true },
    });
    if (!invoice) return;

    const sums = await tx.receipt.aggregate({
      where: { tenantId: session.user.tenantId, clientInvoiceId },
      _sum: { amountReceived: true, tdsAmount: true },
    });

    const received = Number(sums._sum.amountReceived ?? 0);
    const tds = Number(sums._sum.tdsAmount ?? 0);
    const effective = received + tds;

    const status = effective >= Number(invoice.total) ? "PAID" : effective > 0 ? "PARTIAL" : "DUE";

    await tx.clientInvoice.update({
      where: { id: clientInvoiceId, tenantId: session.user.tenantId },
      data: { receivedAmount: received, status },
    });
  });

  revalidatePath(`/app/sales/invoices/${clientInvoiceId}`);
  revalidatePath("/app/sales/receipts");
}

