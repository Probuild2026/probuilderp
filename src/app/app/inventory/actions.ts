"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth/next";

import { stockMovementCreateSchema } from "@/lib/validators/stock";
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
      referenceType: "ADJUSTMENT",
      referenceId: null,
      remarks: parsed.remarks?.trim() ? parsed.remarks.trim() : null,
    },
  });

  revalidatePath("/app/inventory");
}

