"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth/next";
import { z } from "zod";

import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

import { type ActionResult, unknownError, zodToFieldErrors } from "./_result";

const poLineSchema = z.object({
  description: z.string().min(1).max(500),
  unit: z.string().max(20).optional(),
  quantity: z.coerce.number().positive(),
  rate: z.coerce.number().min(0),
});

const createPurchaseOrderSchema = z
  .object({
    vendorId: z.string().min(1),
    projectId: z.string().min(1),
    orderNumber: z.string().min(1).max(50),
    orderDate: z.string().min(1),
    notes: z.string().max(2000).optional(),
    lines: z.array(poLineSchema).min(1, "At least one line item is required"),
  })
  .strict();

const updatePurchaseOrderSchema = createPurchaseOrderSchema.extend({
  id: z.string().min(1),
  status: z.enum(["DRAFT", "SENT", "PARTIALLY_BILLED", "FULLY_BILLED", "CANCELLED"]).optional(),
});

export async function createPurchaseOrder(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } };

  const parsed = createPurchaseOrderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: { code: "VALIDATION", message: "Invalid input", fieldErrors: zodToFieldErrors(parsed.error) } };

  try {
    const existing = await prisma.purchaseOrder.findFirst({
      where: { tenantId: session.user.tenantId, orderNumber: parsed.data.orderNumber.trim() },
      select: { id: true },
    });
    if (existing) return { ok: false, error: { code: "CONFLICT", message: `Order number "${parsed.data.orderNumber}" already exists.` } };

    const created = await prisma.purchaseOrder.create({
      data: {
        tenantId: session.user.tenantId,
        vendorId: parsed.data.vendorId,
        projectId: parsed.data.projectId,
        orderNumber: parsed.data.orderNumber.trim(),
        orderDate: new Date(parsed.data.orderDate),
        notes: parsed.data.notes?.trim() || null,
        lines: {
          create: parsed.data.lines.map((line, idx) => ({
            tenantId: session.user.tenantId,
            description: line.description.trim(),
            unit: line.unit?.trim() || null,
            quantity: new Prisma.Decimal(line.quantity),
            rate: new Prisma.Decimal(line.rate),
            amount: new Prisma.Decimal(line.quantity * line.rate),
            sortOrder: idx,
          })),
        },
      },
      select: { id: true },
    });
    revalidatePath("/app/purchases/orders");
    return { ok: true, data: { id: created.id } };
  } catch {
    return unknownError("Failed to create purchase order.");
  }
}

export async function updatePurchaseOrderStatus(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } };

  const parsed = z.object({ id: z.string().min(1), status: z.enum(["DRAFT", "SENT", "PARTIALLY_BILLED", "FULLY_BILLED", "CANCELLED"]) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: { code: "VALIDATION", message: "Invalid input" } };

  try {
    const updated = await prisma.purchaseOrder.updateMany({
      where: { tenantId: session.user.tenantId, id: parsed.data.id },
      data: { status: parsed.data.status },
    });
    if (updated.count === 0) return { ok: false, error: { code: "NOT_FOUND", message: "Purchase order not found." } };
    revalidatePath(`/app/purchases/orders/${parsed.data.id}`);
    revalidatePath("/app/purchases/orders");
    return { ok: true, data: { id: parsed.data.id } };
  } catch {
    return unknownError("Failed to update status.");
  }
}

export async function deletePurchaseOrder(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } };

  const parsed = z.object({ id: z.string().min(1) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: { code: "VALIDATION", message: "Invalid input" } };

  try {
    const linkedBills = await prisma.purchaseInvoice.count({
      where: { tenantId: session.user.tenantId, purchaseOrderId: parsed.data.id },
    });
    if (linkedBills > 0) return { ok: false, error: { code: "CONFLICT", message: "Cannot delete PO: bills are linked to it. Remove the PO link from bills first." } };

    const deleted = await prisma.purchaseOrder.deleteMany({
      where: { tenantId: session.user.tenantId, id: parsed.data.id },
    });
    if (deleted.count === 0) return { ok: false, error: { code: "NOT_FOUND", message: "Purchase order not found." } };
    revalidatePath("/app/purchases/orders");
    return { ok: true, data: { id: parsed.data.id } };
  } catch {
    return unknownError("Failed to delete purchase order.");
  }
}

export type { ActionResult };
