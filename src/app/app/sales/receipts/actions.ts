"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth/next";

import { type ActionResult, unknownError, zodToFieldErrors } from "@/app/actions/_result";
import { receiptCreateSchema, receiptUpdateSchema } from "@/lib/validators/receipt";
import { authOptions } from "@/server/auth";
import { writeAuditLog } from "@/server/audit";
import { prisma } from "@/server/db";

function parseDateOnly(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid date");
  return date;
}

async function recomputeStageCollections(tx: Prisma.TransactionClient, tenantId: number, stageId: string) {
  const grouped = await tx.receipt.groupBy({
    by: ["channel"],
    where: { tenantId, projectPaymentStageId: stageId },
    _sum: { amountReceived: true },
  });

  let bank = 0;
  let cash = 0;
  for (const row of grouped) {
    const sum = Number(row._sum.amountReceived ?? 0);
    if (row.channel === "CASH") cash = sum;
    if (row.channel === "BANK") bank = sum;
  }

  await tx.projectPaymentStage.updateMany({
    where: { tenantId, id: stageId },
    data: {
      actualBank: new Prisma.Decimal(bank).toDecimalPlaces(2),
      actualCash: new Prisma.Decimal(cash).toDecimalPlaces(2),
    },
  });
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
  let projectId: string | null = null;

  await prisma.$transaction(async (tx) => {
    const invoice = await tx.clientInvoice.findFirst({
      where: { id: parsed.clientInvoiceId, tenantId: session.user.tenantId },
      select: { id: true, total: true, projectId: true, clientId: true, invoiceNumber: true },
    });
    if (!invoice) throw new Error("Invoice not found.");
    projectId = invoice.projectId;

    // Every money movement is a Transaction (cash/bank inflow).
    const txn = await tx.transaction.create({
      data: {
        tenantId: session.user.tenantId,
        type: "INCOME",
        date: parseDateOnly(parsed.date),
        amount: parsed.amountReceived,
        projectId: invoice.projectId,
        mode: parsed.mode,
        channel: parsed.channel,
        reference: parsed.reference?.trim() ? parsed.reference.trim() : null,
        note: `Receipt for invoice ${invoice.invoiceNumber}`,
        description: parsed.remarks?.trim() ? parsed.remarks.trim() : null,
      },
      select: { id: true },
    });

    // Receipt is a document/voucher; link it to the money transaction.
    const receipt = await tx.receipt.create({
      data: {
        tenantId: session.user.tenantId,
        clientInvoiceId: parsed.clientInvoiceId,
        transactionId: txn.id,
        projectPaymentStageId: parsed.projectPaymentStageId ?? null,
        date: parseDateOnly(parsed.date),
        amountReceived: parsed.amountReceived,
        mode: parsed.mode,
        channel: parsed.channel,
        reference: parsed.reference?.trim() ? parsed.reference.trim() : null,
        tdsDeducted: !!parsed.tdsDeducted,
        tdsAmount: parsed.tdsDeducted ? tdsAmount : null,
        remarks: parsed.remarks?.trim() ? parsed.remarks.trim() : null,
      },
      select: { id: true },
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

    await writeAuditLog(tx, {
      tenantId: session.user.tenantId,
      userId: session.user.id,
      userEmail: session.user.email,
      action: "CREATE",
      entityType: "RECEIPT",
      entityId: receipt.id,
      summary: `Receipt created for invoice ${invoice.invoiceNumber}.`,
      metadata: {
        clientInvoiceId: parsed.clientInvoiceId,
        projectId: invoice.projectId,
        amountReceived: parsed.amountReceived,
        tdsAmount,
        mode: parsed.mode,
      },
    });

    if (parsed.projectPaymentStageId) {
      await recomputeStageCollections(tx, session.user.tenantId, parsed.projectPaymentStageId);
    }
  });

  if (projectId) revalidatePath(`/app/projects/${projectId}`);
  revalidatePath("/app/projects");
  revalidatePath(`/app/sales/invoices/${parsed.clientInvoiceId}`);
  revalidatePath("/app/sales/receipts");
}

export async function deleteReceipt(id: string, clientInvoiceId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  let projectId: string | null = null;

  await prisma.$transaction(async (tx) => {
    const receipt = await tx.receipt.findFirst({
      where: { id, tenantId: session.user.tenantId },
      select: {
        id: true,
        transactionId: true,
        projectPaymentStageId: true,
        amountReceived: true,
        tdsAmount: true,
        clientInvoiceId: true,
        clientInvoice: { select: { projectId: true } },
      },
    });
    if (!receipt) return;
    projectId = receipt.clientInvoice.projectId;

    await writeAuditLog(tx, {
      tenantId: session.user.tenantId,
      userId: session.user.id,
      userEmail: session.user.email,
      action: "DELETE",
      entityType: "RECEIPT",
      entityId: receipt.id,
      summary: "Receipt deleted.",
      metadata: {
        clientInvoiceId: receipt.clientInvoiceId,
        amountReceived: Number(receipt.amountReceived),
        tdsAmount: Number(receipt.tdsAmount ?? 0),
      },
    });

    await tx.receipt.deleteMany({ where: { id, tenantId: session.user.tenantId } });

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
      await tx.attachment.deleteMany({
        where: { tenantId: session.user.tenantId, entityType: "TRANSACTION", entityId: receipt.transactionId },
      });
      await tx.transaction.deleteMany({ where: { id: receipt.transactionId, tenantId: session.user.tenantId } });
    }

    if (receipt.projectPaymentStageId) {
      await recomputeStageCollections(tx, session.user.tenantId, receipt.projectPaymentStageId);
    }
  });

  if (projectId) revalidatePath(`/app/projects/${projectId}`);
  revalidatePath("/app/projects");
  revalidatePath(`/app/sales/invoices/${clientInvoiceId}`);
  revalidatePath("/app/sales/receipts");
}

export async function updateReceipt(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } };

  const parsed = receiptUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: "VALIDATION", message: "Invalid input", fieldErrors: zodToFieldErrors(parsed.error) },
    };
  }

  try {
    const tdsAmount = parsed.data.tdsDeducted ? Number(parsed.data.tdsAmount ?? 0) : 0;
    const cashAmount = parsed.data.amountReceived;
    const grossAmount = cashAmount + tdsAmount;
    const date = parseDateOnly(parsed.data.date);
    let projectId: string | null = null;

    const res = await prisma.$transaction(async (tx) => {
      const existing = await tx.receipt.findFirst({
        where: { tenantId: session.user.tenantId, id: parsed.data.id },
        select: { id: true, transactionId: true, clientInvoiceId: true, projectPaymentStageId: true },
      });
      if (!existing) return { ok: false as const, code: "NOT_FOUND" as const };
      if (existing.clientInvoiceId !== parsed.data.clientInvoiceId) return { ok: false as const, code: "CONFLICT" as const };

      const invoice = await tx.clientInvoice.findFirst({
        where: { tenantId: session.user.tenantId, id: parsed.data.clientInvoiceId },
        select: { id: true, projectId: true, clientId: true, invoiceNumber: true },
      });
      if (!invoice) return { ok: false as const, code: "NOT_FOUND_INVOICE" as const };
      projectId = invoice.projectId;

      const txnId =
        existing.transactionId ??
        (
          await tx.transaction.create({
            data: {
              tenantId: session.user.tenantId,
              type: "INCOME",
              date,
              amount: new Prisma.Decimal(cashAmount).toDecimalPlaces(2),
              tdsAmount: new Prisma.Decimal(tdsAmount).toDecimalPlaces(2),
              tdsBaseAmount: new Prisma.Decimal(0),
              projectId: invoice.projectId,
              clientId: invoice.clientId,
              mode: parsed.data.mode,
              channel: parsed.data.channel,
              reference: parsed.data.reference?.trim() ? parsed.data.reference.trim() : null,
              note: `Receipt for invoice ${invoice.invoiceNumber}`,
              description: parsed.data.remarks?.trim() ? parsed.data.remarks.trim() : null,
            },
            select: { id: true },
          })
        ).id;

      await tx.transaction.updateMany({
        where: { tenantId: session.user.tenantId, id: txnId },
        data: {
          date,
          amount: new Prisma.Decimal(cashAmount).toDecimalPlaces(2),
          tdsAmount: new Prisma.Decimal(tdsAmount).toDecimalPlaces(2),
          projectId: invoice.projectId,
          clientId: invoice.clientId,
          mode: parsed.data.mode,
          channel: parsed.data.channel,
          reference: parsed.data.reference?.trim() ? parsed.data.reference.trim() : null,
          description: parsed.data.remarks?.trim() ? parsed.data.remarks.trim() : null,
        },
      });

      await tx.receipt.updateMany({
        where: { tenantId: session.user.tenantId, id: parsed.data.id },
        data: {
          transactionId: txnId,
          date,
          amountReceived: new Prisma.Decimal(cashAmount).toDecimalPlaces(2),
          mode: parsed.data.mode,
          channel: parsed.data.channel,
          projectPaymentStageId: parsed.data.projectPaymentStageId ?? null,
          reference: parsed.data.reference?.trim() ? parsed.data.reference.trim() : null,
          tdsDeducted: !!parsed.data.tdsDeducted,
          tdsAmount: parsed.data.tdsDeducted ? new Prisma.Decimal(tdsAmount).toDecimalPlaces(2) : null,
          remarks: parsed.data.remarks?.trim() ? parsed.data.remarks.trim() : null,
        },
      });

      const updated = await tx.transactionAllocation.updateMany({
        where: {
          tenantId: session.user.tenantId,
          transactionId: txnId,
          documentType: "CLIENT_INVOICE",
          documentId: parsed.data.clientInvoiceId,
        },
        data: {
          projectId: invoice.projectId,
          cashAmount: new Prisma.Decimal(cashAmount).toDecimalPlaces(2),
          tdsAmount: new Prisma.Decimal(tdsAmount).toDecimalPlaces(2),
          grossAmount: new Prisma.Decimal(grossAmount).toDecimalPlaces(2),
        },
      });

      if (updated.count === 0) {
        await tx.transactionAllocation.create({
          data: {
            tenantId: session.user.tenantId,
            transactionId: txnId,
            documentType: "CLIENT_INVOICE",
            documentId: parsed.data.clientInvoiceId,
            projectId: invoice.projectId,
            cashAmount: new Prisma.Decimal(cashAmount).toDecimalPlaces(2),
            tdsAmount: new Prisma.Decimal(tdsAmount).toDecimalPlaces(2),
            grossAmount: new Prisma.Decimal(grossAmount).toDecimalPlaces(2),
          },
        });
      }

      await writeAuditLog(tx, {
        tenantId: session.user.tenantId,
        userId: session.user.id,
        userEmail: session.user.email,
        action: "UPDATE",
        entityType: "RECEIPT",
        entityId: parsed.data.id,
        summary: `Receipt updated for invoice ${invoice.invoiceNumber}.`,
        metadata: {
          clientInvoiceId: parsed.data.clientInvoiceId,
          projectId: invoice.projectId,
          amountReceived: cashAmount,
          tdsAmount,
          mode: parsed.data.mode,
        },
      });

      if (existing.projectPaymentStageId && existing.projectPaymentStageId !== parsed.data.projectPaymentStageId) {
        await recomputeStageCollections(tx, session.user.tenantId, existing.projectPaymentStageId);
      }
      if (parsed.data.projectPaymentStageId) {
        await recomputeStageCollections(tx, session.user.tenantId, parsed.data.projectPaymentStageId);
      }

      return { ok: true as const };
    });

    if (!res.ok) {
      if (res.code === "CONFLICT") return { ok: false, error: { code: "CONFLICT", message: "Receipt is linked to a different invoice." } };
      return { ok: false, error: { code: "NOT_FOUND", message: "Receipt not found." } };
    }

    revalidatePath(`/app/sales/receipts/${parsed.data.id}`);
    if (projectId) revalidatePath(`/app/projects/${projectId}`);
    revalidatePath("/app/projects");
    revalidatePath(`/app/sales/invoices/${parsed.data.clientInvoiceId}`);
    revalidatePath("/app/sales/receipts");

    return { ok: true, data: { id: parsed.data.id } };
  } catch {
    return unknownError("Failed to update receipt.");
  }
}
