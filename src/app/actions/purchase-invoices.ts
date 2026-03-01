"use server";

import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { z } from "zod";

import { computeGstComponents } from "@/server/domain/gst";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

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
  })
  .strict();

const updatePurchaseInvoiceSchema = createPurchaseInvoiceSchema.extend({
  id: z.string().min(1),
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
    return { ok: true, data: { id: parsed.data.id } };
  } catch {
    return unknownError("Failed to update bill.");
  }
}

export async function deletePurchaseInvoice(id: string): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } };

  try {
    const res = await prisma.$transaction(async (tx) => {
      const invoice = await tx.purchaseInvoice.findFirst({
        where: { tenantId: session.user.tenantId, id },
        select: { id: true },
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
      return { ok: true as const };
    });

    if (!res.ok) {
      if (res.code === "NOT_FOUND") return { ok: false, error: { code: "NOT_FOUND", message: "Bill not found." } };
      if (res.code === "HAS_PAYMENTS") {
        return { ok: false, error: { code: "VALIDATION", message: "Cannot delete this bill because payments are already applied. Remove the payment allocations first." } };
      }
    }

    return { ok: true, data: { id } };
  } catch {
    return unknownError("Failed to delete bill.");
  }
}
