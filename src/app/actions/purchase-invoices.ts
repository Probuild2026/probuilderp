"use server";

import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { z } from "zod";

import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

import { type ActionResult, unknownError, zodToFieldErrors } from "./_result";

const createPurchaseInvoiceSchema = z
  .object({
    vendorId: z.string().min(1),
    projectId: z.string().min(1),
    invoiceNumber: z.string().min(1).max(50),
    invoiceDate: z.string().min(1),
    gstType: z.enum(["INTRA", "INTER"]),
    taxableValue: z.coerce.number().min(0),
    cgst: z.coerce.number().min(0).optional(),
    sgst: z.coerce.number().min(0).optional(),
    igst: z.coerce.number().min(0).optional(),
    total: z.coerce.number().min(0),
    note: z.string().max(2000).optional(),
  })
  .strict();

function parseDateOnly(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid date");
  return date;
}

export async function createPurchaseInvoice(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } };

  const parsed = createPurchaseInvoiceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION", message: "Invalid input", fieldErrors: zodToFieldErrors(parsed.error) } };
  }

  try {
    const created = await prisma.purchaseInvoice.create({
      data: {
        tenantId: session.user.tenantId,
        vendorId: parsed.data.vendorId,
        projectId: parsed.data.projectId,
        invoiceNumber: parsed.data.invoiceNumber.trim(),
        invoiceDate: parseDateOnly(parsed.data.invoiceDate),
        gstType: parsed.data.gstType,
        taxableValue: new Prisma.Decimal(parsed.data.taxableValue),
        cgst: new Prisma.Decimal(parsed.data.cgst ?? 0),
        sgst: new Prisma.Decimal(parsed.data.sgst ?? 0),
        igst: new Prisma.Decimal(parsed.data.igst ?? 0),
        total: new Prisma.Decimal(parsed.data.total),
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

