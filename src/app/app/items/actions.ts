"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth/next";

import { itemUpsertSchema } from "@/lib/validators/item";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

export async function upsertItem(input: unknown) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const parsed = itemUpsertSchema.parse(input);

  const data = {
    tenantId: session.user.tenantId,
    name: parsed.name,
    type: parsed.type,
    unit: parsed.unit?.trim() ? parsed.unit.trim() : null,
    sacHsnCode: parsed.sacHsnCode?.trim() ? parsed.sacHsnCode.trim() : null,
    gstRate: parsed.gstRate,
  } as const;

  if (parsed.id) {
    await prisma.item.update({
      where: { id: parsed.id, tenantId: session.user.tenantId },
      data,
    });
  } else {
    await prisma.item.create({ data });
  }

  revalidatePath("/app/items");
}

export async function deleteItem(id: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  await prisma.item.delete({
    where: { id, tenantId: session.user.tenantId },
  });

  revalidatePath("/app/items");
}
