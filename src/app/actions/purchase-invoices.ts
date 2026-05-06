"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth/next";
import { z } from "zod";

import { computeGstComponents } from "@/server/domain/gst";
import { authOptions } from "@/server/auth";
import { safeWriteAuditLog } from "@/server/audit";
import { prisma } from "@/server/db";
import { tryDeleteStoredFile } from "@/server/storage";

import { type ActionResult, unknownError, zodToFieldErrors } from "./_result";

const createPurchaseInvoiceSchema = z
  .object({
    vendorId: z.string().min(1),
    projectId: z.string().min(1),
    invoiceNumber: z.string().min(1).max(50),
    invoiceDate: z.string().min(1),
    gstType: z.enum(["INTRA", "INTER", "NOGST"]),
    gstRate: z.coerce.number().min(0).max(100).optional(),
    taxableValue: z.coerce.number().min(0),
    cgst: z.coerce.number().min(0).optional(),
    sgst: z.coerce.number().min(0).optional(),
    igst: z.coerce.number().min(0).optional(),
    total: z.coerce.number().min(0),
    note: z.string().max(2000).optional(),
    materialReceiptIds: z.array(z.string().min(1)).optional(),
    attachments: z
      .array(
        z.object({
          url: z.string().url(),
          name: z.string().min(1),
          type: z.string().min(1),
          size: z.number().int().nonnegative(),
        }),
      )
      .optional(),
  })
  .strict();

const updatePurchaseInvoiceSchema = createPurchaseInvoiceSchema.extend({
  id: z.string().min(1),
});

const upsertPurchaseInvoiceLineSchema = z
  .object({
    id: z.string().min(1).optional(),
    purchaseInvoiceId: z.string().min(1),
    itemId: z.string().min(1),
    projectId: z.string().min(1).optional(),
    quantity: z.coerce.number().positive(),
    rate: z.coerce.number().nonnegative(),
  })
  .strict();

const deletePurchaseInvoiceLineSchema = z.object({
  id: z.string().min(1),
  purchaseInvoiceId: z.string().min(1),
});

function parseDateOnly(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid date");
  return date;
}

function inferGstRatePct(input: { taxableValue: number; gstType: "INTRA" | "INTER" | "NOGST"; cgst?: number; sgst?: number; igst?: number }) {
  if (input.gstType === "NOGST") return 0;
  if (!input.taxableValue) return undefined;
  if (input.gstType === "INTRA") {
    const t = (input.cgst ?? 0) + (input.sgst ?? 0);
    if (t <= 0) return undefined;
    return (t / input.taxableValue) * 100;
  }
  const t = input.igst ?? 0;
  if (t <= 0) return undefined;
  return (t / input.taxableValue) * 100;
}

export async function createPurchaseInvoice(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } };

  const parsed = createPurchaseInvoiceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION", message: "Invalid input", fieldErrors: zodToFieldErrors(parsed.error) } };
  }

  try {
    const taxableValue = parsed.data.taxableValue;
    const gstRate = parsed.data.gstRate ?? inferGstRatePct(parsed.data);
    const computed =
      gstRate == null
        ? null
        : computeGstComponents({
            taxableValue,
            gstRate,
            gstType: parsed.data.gstType,
          });

    const receiptIds = parsed.data.materialReceiptIds ?? [];
    if (receiptIds.length > 0) {
      const receiptCount = await prisma.materialReceipt.count({
        where: {
          tenantId: session.user.tenantId,
          id: { in: receiptIds },
          vendorId: parsed.data.vendorId,
          projectId: parsed.data.projectId,
        },
      });
      if (receiptCount !== receiptIds.length) {
        return { ok: false, error: { code: "VALIDATION", message: "One or more selected material deliveries do not match this bill." } };
      }
    }

    const created = await prisma.purchaseInvoice.create({
      data: {
        tenantId: session.user.tenantId,
        vendorId: parsed.data.vendorId,
        projectId: parsed.data.projectId,
        invoiceNumber: parsed.data.invoiceNumber.trim(),
        invoiceDate: parseDateOnly(parsed.data.invoiceDate),
        gstType: parsed.data.gstType,
        gstRate: gstRate == null ? null : new Prisma.Decimal(gstRate),
        taxableValue: new Prisma.Decimal(parsed.data.taxableValue),
        cgst: new Prisma.Decimal(computed?.cgst ?? parsed.data.cgst ?? 0),
        sgst: new Prisma.Decimal(computed?.sgst ?? parsed.data.sgst ?? 0),
        igst: new Prisma.Decimal(computed?.igst ?? parsed.data.igst ?? 0),
        total: new Prisma.Decimal(computed?.total ?? parsed.data.total),
        // keep TDS fields for later (on the invoice itself) — payments screen computes live TDS
        tdsApplicable: false,
      },
      select: { id: true },
    });
    if (receiptIds.length > 0) {
      await prisma.materialReceipt.updateMany({
        where: {
          tenantId: session.user.tenantId,
          id: { in: receiptIds },
          vendorId: parsed.data.vendorId,
          projectId: parsed.data.projectId,
        },
        data: { purchaseInvoiceId: created.id },
      });
    }
    if (parsed.data.attachments?.length) {
      await prisma.attachment.createMany({
        data: parsed.data.attachments.map((attachment) => ({
          tenantId: session.user.tenantId,
          entityType: "PURCHASE_INVOICE",
          entityId: created.id,
          projectId: parsed.data.projectId,
          originalName: attachment.name,
          mimeType: attachment.type,
          size: attachment.size,
          storagePath: attachment.url,
          uploadedById: session.user.id,
        })),
      });
    }
    await safeWriteAuditLog({
      tenantId: session.user.tenantId,
      userId: session.user.id,
      userEmail: session.user.email,
      action: "CREATE",
      entityType: "BILL",
      entityId: created.id,
      summary: `Bill ${parsed.data.invoiceNumber.trim()} created.`,
      metadata: {
        invoiceNumber: parsed.data.invoiceNumber.trim(),
        vendorId: parsed.data.vendorId,
        projectId: parsed.data.projectId,
        total: parsed.data.total,
        materialReceiptIds: receiptIds,
        attachments: parsed.data.attachments?.length ?? 0,
      },
    });
    revalidatePath("/app/purchases/bills");
    revalidatePath("/app/purchases/materials");
    return { ok: true, data: created };
  } catch {
    return unknownError("Failed to create bill.");
  }
}

export async function updatePurchaseInvoice(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } };

  const parsed = updatePurchaseInvoiceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION", message: "Invalid input", fieldErrors: zodToFieldErrors(parsed.error) } };
  }

  try {
    const taxableValue = parsed.data.taxableValue;
    const gstRate = parsed.data.gstRate ?? inferGstRatePct(parsed.data);
    const computed =
      gstRate == null
        ? null
        : computeGstComponents({
            taxableValue,
            gstRate,
            gstType: parsed.data.gstType,
          });

    const receiptIds = parsed.data.materialReceiptIds ?? [];
    if (receiptIds.length > 0) {
      const receiptCount = await prisma.materialReceipt.count({
        where: {
          tenantId: session.user.tenantId,
          id: { in: receiptIds },
          vendorId: parsed.data.vendorId,
          projectId: parsed.data.projectId,
        },
      });
      if (receiptCount !== receiptIds.length) {
        return { ok: false, error: { code: "VALIDATION", message: "One or more selected material deliveries do not match this bill." } };
      }
    }

    const res = await prisma.purchaseInvoice.updateMany({
      where: { tenantId: session.user.tenantId, id: parsed.data.id },
      data: {
        vendorId: parsed.data.vendorId,
        projectId: parsed.data.projectId,
        invoiceNumber: parsed.data.invoiceNumber.trim(),
        invoiceDate: parseDateOnly(parsed.data.invoiceDate),
        gstType: parsed.data.gstType,
        gstRate: gstRate == null ? null : new Prisma.Decimal(gstRate),
        taxableValue: new Prisma.Decimal(parsed.data.taxableValue),
        cgst: new Prisma.Decimal(computed?.cgst ?? parsed.data.cgst ?? 0),
        sgst: new Prisma.Decimal(computed?.sgst ?? parsed.data.sgst ?? 0),
        igst: new Prisma.Decimal(computed?.igst ?? parsed.data.igst ?? 0),
        total: new Prisma.Decimal(computed?.total ?? parsed.data.total),
      },
    });
    if (res.count === 0) return { ok: false, error: { code: "NOT_FOUND", message: "Bill not found." } };
    if (receiptIds.length > 0) {
      await prisma.materialReceipt.updateMany({
        where: {
          tenantId: session.user.tenantId,
          id: { in: receiptIds },
          vendorId: parsed.data.vendorId,
          projectId: parsed.data.projectId,
        },
        data: { purchaseInvoiceId: parsed.data.id },
      });
    }
    if (parsed.data.attachments?.length) {
      await prisma.attachment.createMany({
        data: parsed.data.attachments.map((attachment) => ({
          tenantId: session.user.tenantId,
          entityType: "PURCHASE_INVOICE",
          entityId: parsed.data.id,
          projectId: parsed.data.projectId,
          originalName: attachment.name,
          mimeType: attachment.type,
          size: attachment.size,
          storagePath: attachment.url,
          uploadedById: session.user.id,
        })),
      });
    }
    await safeWriteAuditLog({
      tenantId: session.user.tenantId,
      userId: session.user.id,
      userEmail: session.user.email,
      action: "UPDATE",
      entityType: "BILL",
      entityId: parsed.data.id,
      summary: `Bill ${parsed.data.invoiceNumber.trim()} updated.`,
      metadata: {
        invoiceNumber: parsed.data.invoiceNumber.trim(),
        vendorId: parsed.data.vendorId,
        projectId: parsed.data.projectId,
        total: parsed.data.total,
        materialReceiptIds: receiptIds,
        attachments: parsed.data.attachments?.length ?? 0,
      },
    });
    revalidatePath("/app/purchases/bills");
    revalidatePath(`/app/purchases/bills/${parsed.data.id}`);
    revalidatePath("/app/purchases/materials");
    return { ok: true, data: { id: parsed.data.id } };
  } catch {
    return unknownError("Failed to update bill.");
  }
}

export async function deletePurchaseInvoice(id: string): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } };

  try {
    const attachments = await prisma.attachment.findMany({
      where: { tenantId: session.user.tenantId, entityType: "PURCHASE_INVOICE", entityId: id },
      select: { storagePath: true },
    });

    const res = await prisma.$transaction(async (tx) => {
      const invoice = await tx.purchaseInvoice.findFirst({
        where: { tenantId: session.user.tenantId, id },
        select: { id: true, invoiceNumber: true },
      });
      if (!invoice) return { ok: false as const, code: "NOT_FOUND" as const };

      const allocCount = await tx.transactionAllocation.count({
        where: { tenantId: session.user.tenantId, documentType: "PURCHASE_INVOICE", documentId: id },
      });
      if (allocCount > 0) return { ok: false as const, code: "HAS_PAYMENTS" as const };

      await tx.attachment.deleteMany({
        where: { tenantId: session.user.tenantId, entityType: "PURCHASE_INVOICE", entityId: id },
      });
      await tx.purchaseInvoiceLine.deleteMany({ where: { tenantId: session.user.tenantId, purchaseInvoiceId: id } });
      const del = await tx.purchaseInvoice.deleteMany({ where: { tenantId: session.user.tenantId, id } });
      if (del.count === 0) return { ok: false as const, code: "NOT_FOUND" as const };
      return { ok: true as const, invoiceNumber: invoice.invoiceNumber };
    });

    if (!res.ok) {
      if (res.code === "NOT_FOUND") return { ok: false, error: { code: "NOT_FOUND", message: "Bill not found." } };
      if (res.code === "HAS_PAYMENTS") {
        return { ok: false, error: { code: "VALIDATION", message: "Cannot delete this bill because payments are already applied. Remove the payment allocations first." } };
      }
    }

    if (res.ok) {
      await Promise.allSettled(attachments.map((attachment) => tryDeleteStoredFile(attachment.storagePath)));
      await safeWriteAuditLog({
        tenantId: session.user.tenantId,
        userId: session.user.id,
        userEmail: session.user.email,
        action: "DELETE",
        entityType: "BILL",
        entityId: id,
        summary: `Bill ${res.invoiceNumber} deleted.`,
        metadata: { invoiceNumber: res.invoiceNumber },
      });
    }

    revalidatePath("/app/purchases/bills");
    return { ok: true, data: { id } };
  } catch {
    return unknownError("Failed to delete bill.");
  }
}

export async function upsertPurchaseInvoiceLine(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } };

  const parsed = upsertPurchaseInvoiceLineSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION", message: "Invalid input", fieldErrors: zodToFieldErrors(parsed.error) } };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const invoice = await tx.purchaseInvoice.findFirst({
        where: { tenantId: session.user.tenantId, id: parsed.data.purchaseInvoiceId },
        select: { id: true, projectId: true },
      });
      if (!invoice) return { ok: false as const };

      const finalProjectId = parsed.data.projectId?.trim() || invoice.projectId;
      const amount = Number((parsed.data.quantity * parsed.data.rate).toFixed(2));

      if (parsed.data.id) {
        const updated = await tx.purchaseInvoiceLine.updateMany({
          where: { tenantId: session.user.tenantId, id: parsed.data.id, purchaseInvoiceId: invoice.id },
          data: {
            itemId: parsed.data.itemId,
            projectId: finalProjectId,
            quantity: new Prisma.Decimal(parsed.data.quantity),
            rate: new Prisma.Decimal(parsed.data.rate),
            amount: new Prisma.Decimal(amount),
          },
        });
        if (updated.count === 0) return { ok: false as const };
        return { ok: true as const, id: parsed.data.id };
      }

      const created = await tx.purchaseInvoiceLine.create({
        data: {
          tenantId: session.user.tenantId,
          purchaseInvoiceId: invoice.id,
          itemId: parsed.data.itemId,
          projectId: finalProjectId,
          quantity: new Prisma.Decimal(parsed.data.quantity),
          rate: new Prisma.Decimal(parsed.data.rate),
          amount: new Prisma.Decimal(amount),
        },
        select: { id: true },
      });
      return { ok: true as const, id: created.id };
    });

    if (!result.ok) return { ok: false, error: { code: "NOT_FOUND", message: "Bill or line item not found." } };
    return { ok: true, data: { id: result.id } };
  } catch {
    return unknownError("Failed to save line item.");
  }
}

export async function deletePurchaseInvoiceLine(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } };

  const parsed = deletePurchaseInvoiceLineSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION", message: "Invalid input", fieldErrors: zodToFieldErrors(parsed.error) } };
  }

  try {
    const deleted = await prisma.purchaseInvoiceLine.deleteMany({
      where: {
        tenantId: session.user.tenantId,
        id: parsed.data.id,
        purchaseInvoiceId: parsed.data.purchaseInvoiceId,
      },
    });
    if (deleted.count === 0) return { ok: false, error: { code: "NOT_FOUND", message: "Line item not found." } };
    return { ok: true, data: { id: parsed.data.id } };
  } catch {
    return unknownError("Failed to delete line item.");
  }
}
