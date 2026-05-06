"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth/next";

import { stockMovementCreateSchema, stockMovementDeleteSchema, stockMovementUpdateSchema } from "@/lib/validators/stock";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

function parseDateOnly(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid date");
  return date;
}

export async function createStockMovement(input: unknown) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const parsed = stockMovementCreateSchema.parse(input);

  await prisma.stockMovement.create({
    data: {
      tenantId: session.user.tenantId,
      projectId: parsed.projectId,
      itemId: parsed.itemId,
      date: parseDateOnly(parsed.date),
      direction: parsed.direction,
      quantity: parsed.quantity,
      unitCost: typeof parsed.unitCost === "number" ? parsed.unitCost : null,
      stageName: parsed.stageName?.trim() ? parsed.stageName.trim() : null,
      referenceType: "ADJUSTMENT",
      referenceId: null,
      remarks: parsed.remarks?.trim() ? parsed.remarks.trim() : null,
    },
  });

  revalidatePath("/app/inventory");
  revalidatePath("/app/purchases/materials");
}

export async function updateStockMovement(input: unknown) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const parsed = stockMovementUpdateSchema.parse(input);

  const existing = await prisma.stockMovement.findFirst({
    where: { tenantId: session.user.tenantId, id: parsed.id },
    select: { id: true, referenceType: true },
  });
  if (!existing) throw new Error("Stock movement not found");
  if (existing.referenceType === "MATERIAL_RECEIPT") {
    throw new Error("Edit the linked material delivery instead.");
  }

  await prisma.stockMovement.update({
    where: { id: existing.id },
    data: {
      projectId: parsed.projectId,
      itemId: parsed.itemId,
      date: parseDateOnly(parsed.date),
      direction: parsed.direction,
      quantity: parsed.quantity,
      unitCost: typeof parsed.unitCost === "number" ? parsed.unitCost : null,
      stageName: parsed.stageName?.trim() ? parsed.stageName.trim() : null,
      remarks: parsed.remarks?.trim() ? parsed.remarks.trim() : null,
    },
  });

  revalidatePath("/app/inventory");
  revalidatePath("/app/purchases/materials");
}

export async function deleteStockMovement(input: unknown) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const parsed = stockMovementDeleteSchema.parse(input);
  const existing = await prisma.stockMovement.findFirst({
    where: { tenantId: session.user.tenantId, id: parsed.id },
    select: { id: true, referenceType: true },
  });
  if (!existing) throw new Error("Stock movement not found");
  if (existing.referenceType === "MATERIAL_RECEIPT") {
    throw new Error("Delete the linked material delivery instead.");
  }

  await prisma.stockMovement.delete({ where: { id: existing.id } });

  revalidatePath("/app/inventory");
  revalidatePath("/app/purchases/materials");
}
