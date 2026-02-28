"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth/next";

import { receiptCreateSchema } from "@/lib/validators/receipt";
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

  const raw = Object.fromEntries(formData.entries());
  const parsed = receiptCreateSchema.parse({
    ...raw,
    // UI sends "1"/"0"
    tdsDeducted: String(formData.get("tdsDeducted") ?? "") === "1",
  });

  const tdsAmount = parsed.tdsDeducted ? Number(parsed.tdsAmount ?? 0) : 0;

  await prisma.$transaction(async (tx) => {
    const invoice = await tx.clientInvoice.findFirst({
      where: { id: parsed.clientInvoiceId, tenantId: session.user.tenantId },
      select: { id: true, total: true, projectId: true, clientId: true, invoiceNumber: true },
    });
    if (!invoice) throw new Error("Invoice not found.");

    // Every money movement is a Transaction (cash/bank inflow).
    const txn = await tx.transaction.create({
      data: {
        tenantId: session.user.tenantId,
        type: "INCOME",
        date: parseDateOnly(parsed.date),
        amount: parsed.amountReceived,
        projectId: invoice.projectId,
        note: `Receipt for invoice ${invoice.invoiceNumber}`,
        description: parsed.remarks?.trim() ? parsed.remarks.trim() : null,
      },
      select: { id: true },
    });

    // Receipt is a document/voucher; link it to the money transaction.
    await tx.receipt.create({
      data: {
        tenantId: session.user.tenantId,
        clientInvoiceId: parsed.clientInvoiceId,
        transactionId: txn.id,
        date: parseDateOnly(parsed.date),
        amountReceived: parsed.amountReceived,
        mode: parsed.mode,
        reference: parsed.reference?.trim() ? parsed.reference.trim() : null,
        tdsDeducted: !!parsed.tdsDeducted,
        tdsAmount: parsed.tdsDeducted ? tdsAmount : null,
        remarks: parsed.remarks?.trim() ? parsed.remarks.trim() : null,
      },
    });

    // Allocation settles the invoice (gross = cash received + TDS).
    await tx.transactionAllocation.create({
      data: {
        tenantId: session.user.tenantId,
        transactionId: txn.id,
        documentType: "CLIENT_INVOICE",
        documentId: parsed.clientInvoiceId,
        projectId: invoice.projectId,
        cashAmount: parsed.amountReceived,
        tdsAmount,
        grossAmount: parsed.amountReceived + tdsAmount,
      },
    });
  });

  revalidatePath(`/app/sales/invoices/${parsed.clientInvoiceId}`);
  revalidatePath("/app/sales/receipts");
}

export async function deleteReceipt(id: string, clientInvoiceId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  await prisma.$transaction(async (tx) => {
    const receipt = await tx.receipt.findFirst({
      where: { id, tenantId: session.user.tenantId },
      select: { id: true, transactionId: true },
    });
    if (!receipt) return;

    await tx.receipt.delete({ where: { id, tenantId: session.user.tenantId } });

    // If it was created by the new flow, remove allocation + underlying transaction.
    if (receipt.transactionId) {
      await tx.transactionAllocation.deleteMany({
        where: {
          tenantId: session.user.tenantId,
          transactionId: receipt.transactionId,
          documentType: "CLIENT_INVOICE",
          documentId: clientInvoiceId,
        },
      });
      await tx.transaction.delete({ where: { id: receipt.transactionId, tenantId: session.user.tenantId } });
    }
  });

  revalidatePath(`/app/sales/invoices/${clientInvoiceId}`);
  revalidatePath("/app/sales/receipts");
}
