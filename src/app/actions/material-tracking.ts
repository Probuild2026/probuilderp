"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth/next";

import {
  materialOrderCreateSchema,
  materialReceiptBillLinkSchema,
  materialReceiptCreateSchema,
} from "@/lib/validators/material-tracking";
import { authOptions } from "@/server/auth";
import { safeWriteAuditLog } from "@/server/audit";
import { prisma } from "@/server/db";

import { type ActionResult, unknownError, zodToFieldErrors } from "./_result";

function parseDateOnly(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid date");
  return date;
}

function optionalDate(value?: string) {
  return value ? parseDateOnly(value) : null;
}

function optionalDecimal(value?: number) {
  return typeof value === "number" ? new Prisma.Decimal(value) : null;
}

function amount(quantity: number, rate?: number) {
  if (typeof rate !== "number") return null;
  return new Prisma.Decimal(Number((quantity * rate).toFixed(2)));
}

async function refreshMaterialTracking(paths: string[] = []) {
  revalidatePath("/app/purchases/materials");
  revalidatePath("/app/inventory");
  for (const path of paths) revalidatePath(path);
}

export async function createMaterialOrder(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } };

  const parsed = materialOrderCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION", message: "Invalid input", fieldErrors: zodToFieldErrors(parsed.error) } };
  }

  try {
    const [project, vendor, item] = await Promise.all([
      prisma.project.findFirst({ where: { tenantId: session.user.tenantId, id: parsed.data.projectId }, select: { id: true, name: true } }),
      prisma.vendor.findFirst({ where: { tenantId: session.user.tenantId, id: parsed.data.vendorId }, select: { id: true, name: true } }),
      prisma.item.findFirst({ where: { tenantId: session.user.tenantId, id: parsed.data.itemId, type: "MATERIAL" }, select: { id: true, name: true } }),
    ]);

    if (!project || !vendor || !item) {
      return { ok: false, error: { code: "VALIDATION", message: "Project, vendor, or material was not found." } };
    }

    const created = await prisma.materialOrder.create({
      data: {
        tenantId: session.user.tenantId,
        projectId: project.id,
        vendorId: vendor.id,
        itemId: item.id,
        orderDate: parseDateOnly(parsed.data.orderDate),
        expectedDeliveryDate: optionalDate(parsed.data.expectedDeliveryDate),
        quantityOrdered: new Prisma.Decimal(parsed.data.quantityOrdered),
        rate: optionalDecimal(parsed.data.rate),
        amount: amount(parsed.data.quantityOrdered, parsed.data.rate),
        stageName: parsed.data.stageName || null,
        reference: parsed.data.reference || null,
        remarks: parsed.data.remarks || null,
      },
      select: { id: true },
    });

    await safeWriteAuditLog({
      tenantId: session.user.tenantId,
      userId: session.user.id,
      userEmail: session.user.email,
      action: "CREATE",
      entityType: "MATERIAL_ORDER",
      entityId: created.id,
      summary: `${item.name} ordered from ${vendor.name} for ${project.name}.`,
      metadata: {
        projectId: project.id,
        vendorId: vendor.id,
        itemId: item.id,
        quantityOrdered: parsed.data.quantityOrdered,
      },
    });

    await refreshMaterialTracking();
    return { ok: true, data: created };
  } catch {
    return unknownError("Failed to create material order.");
  }
}

export async function createMaterialReceipt(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } };

  const parsed = materialReceiptCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION", message: "Invalid input", fieldErrors: zodToFieldErrors(parsed.error) } };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const [project, vendor, item, order, bill] = await Promise.all([
        tx.project.findFirst({ where: { tenantId: session.user.tenantId, id: parsed.data.projectId }, select: { id: true, name: true } }),
        tx.vendor.findFirst({ where: { tenantId: session.user.tenantId, id: parsed.data.vendorId }, select: { id: true, name: true } }),
        tx.item.findFirst({ where: { tenantId: session.user.tenantId, id: parsed.data.itemId, type: "MATERIAL" }, select: { id: true, name: true } }),
        parsed.data.materialOrderId
          ? tx.materialOrder.findFirst({
              where: { tenantId: session.user.tenantId, id: parsed.data.materialOrderId },
              select: { id: true, projectId: true, vendorId: true, itemId: true, quantityOrdered: true },
            })
          : null,
        parsed.data.purchaseInvoiceId
          ? tx.purchaseInvoice.findFirst({
              where: { tenantId: session.user.tenantId, id: parsed.data.purchaseInvoiceId },
              select: { id: true, projectId: true, vendorId: true },
            })
          : null,
      ]);

      if (!project || !vendor || !item) return { ok: false as const, code: "VALIDATION" as const };

      if (
        order &&
        (order.projectId !== project.id || order.vendorId !== vendor.id || order.itemId !== item.id)
      ) {
        return { ok: false as const, code: "ORDER_MISMATCH" as const };
      }

      if (parsed.data.materialOrderId && !order) return { ok: false as const, code: "ORDER_NOT_FOUND" as const };

      if (bill && (bill.projectId !== project.id || bill.vendorId !== vendor.id)) {
        return { ok: false as const, code: "BILL_MISMATCH" as const };
      }

      if (parsed.data.purchaseInvoiceId && !bill) return { ok: false as const, code: "BILL_NOT_FOUND" as const };

      const receipt = await tx.materialReceipt.create({
        data: {
          tenantId: session.user.tenantId,
          projectId: project.id,
          vendorId: vendor.id,
          itemId: item.id,
          materialOrderId: order?.id ?? null,
          purchaseInvoiceId: bill?.id ?? null,
          receiptDate: parseDateOnly(parsed.data.receiptDate),
          challanNumber: parsed.data.challanNumber || null,
          quantity: new Prisma.Decimal(parsed.data.quantity),
          unitCost: optionalDecimal(parsed.data.unitCost),
          amount: amount(parsed.data.quantity, parsed.data.unitCost),
          stageName: parsed.data.stageName || null,
          vehicleNumber: parsed.data.vehicleNumber || null,
          remarks: parsed.data.remarks || null,
        },
        select: { id: true },
      });

      const stockMovement = await tx.stockMovement.create({
        data: {
          tenantId: session.user.tenantId,
          projectId: project.id,
          itemId: item.id,
          date: parseDateOnly(parsed.data.receiptDate),
          direction: "IN",
          quantity: new Prisma.Decimal(parsed.data.quantity),
          unitCost: optionalDecimal(parsed.data.unitCost),
          stageName: parsed.data.stageName || null,
          referenceType: "MATERIAL_RECEIPT",
          referenceId: receipt.id,
          remarks: parsed.data.challanNumber ? `Delivery challan ${parsed.data.challanNumber}` : parsed.data.remarks || null,
        },
        select: { id: true },
      });

      await tx.materialReceipt.update({
        where: { id: receipt.id },
        data: { stockMovementId: stockMovement.id },
      });

      if (order) {
        const delivered = await tx.materialReceipt.aggregate({
          where: { tenantId: session.user.tenantId, materialOrderId: order.id },
          _sum: { quantity: true },
        });
        const deliveredQty = Number(delivered._sum.quantity ?? 0);
        const orderedQty = Number(order.quantityOrdered);
        const status = deliveredQty + 0.0005 >= orderedQty ? "DELIVERED" : deliveredQty > 0 ? "PARTIALLY_DELIVERED" : "ORDERED";
        await tx.materialOrder.update({
          where: { id: order.id },
          data: { status },
        });
      }

      return {
        ok: true as const,
        id: receipt.id,
        projectName: project.name,
        vendorName: vendor.name,
        itemName: item.name,
        billId: bill?.id,
      };
    });

    if (!result.ok) {
      if (result.code === "ORDER_MISMATCH") {
        return { ok: false, error: { code: "VALIDATION", message: "Selected order does not match the project, vendor, and material." } };
      }
      if (result.code === "BILL_MISMATCH") {
        return { ok: false, error: { code: "VALIDATION", message: "Selected bill does not match the project and vendor." } };
      }
      return { ok: false, error: { code: "VALIDATION", message: "Project, vendor, material, order, or bill was not found." } };
    }

    await safeWriteAuditLog({
      tenantId: session.user.tenantId,
      userId: session.user.id,
      userEmail: session.user.email,
      action: "CREATE",
      entityType: "MATERIAL_RECEIPT",
      entityId: result.id,
      summary: `${result.itemName} delivered by ${result.vendorName} for ${result.projectName}.`,
      metadata: {
        quantity: parsed.data.quantity,
        billId: result.billId ?? null,
      },
    });

    await refreshMaterialTracking(result.billId ? [`/app/purchases/bills/${result.billId}`, "/app/purchases/bills"] : []);
    return { ok: true, data: { id: result.id } };
  } catch {
    return unknownError("Failed to create material receipt.");
  }
}

export async function linkMaterialReceiptToBill(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } };

  const parsed = materialReceiptBillLinkSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION", message: "Invalid input", fieldErrors: zodToFieldErrors(parsed.error) } };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const receipt = await tx.materialReceipt.findFirst({
        where: { tenantId: session.user.tenantId, id: parsed.data.receiptId },
        select: { id: true, projectId: true, vendorId: true },
      });
      if (!receipt) return { ok: false as const, code: "RECEIPT_NOT_FOUND" as const };

      const bill = await tx.purchaseInvoice.findFirst({
        where: { tenantId: session.user.tenantId, id: parsed.data.purchaseInvoiceId },
        select: { id: true, projectId: true, vendorId: true, invoiceNumber: true },
      });
      if (!bill) return { ok: false as const, code: "BILL_NOT_FOUND" as const };
      if (bill.projectId !== receipt.projectId || bill.vendorId !== receipt.vendorId) {
        return { ok: false as const, code: "BILL_MISMATCH" as const };
      }

      await tx.materialReceipt.update({
        where: { id: receipt.id },
        data: { purchaseInvoiceId: bill.id },
      });

      return { ok: true as const, id: receipt.id, billId: bill.id, invoiceNumber: bill.invoiceNumber };
    });

    if (!result.ok) {
      if (result.code === "BILL_MISMATCH") {
        return { ok: false, error: { code: "VALIDATION", message: "Bill must match the delivery project and vendor." } };
      }
      return { ok: false, error: { code: "NOT_FOUND", message: "Delivery or bill not found." } };
    }

    await safeWriteAuditLog({
      tenantId: session.user.tenantId,
      userId: session.user.id,
      userEmail: session.user.email,
      action: "UPDATE",
      entityType: "MATERIAL_RECEIPT",
      entityId: result.id,
      summary: `Delivery linked to bill ${result.invoiceNumber}.`,
      metadata: { billId: result.billId },
    });

    await refreshMaterialTracking([`/app/purchases/bills/${result.billId}`, "/app/purchases/bills"]);
    return { ok: true, data: { id: result.id } };
  } catch {
    return unknownError("Failed to link delivery to bill.");
  }
}
