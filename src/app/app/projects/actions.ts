"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth/next";

import { projectUpsertSchema } from "@/lib/validators/project";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

function parseDateOnly(value?: string) {
  if (!value) return null;
  // `YYYY-MM-DD` from <input type="date">
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function upsertProject(input: unknown) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const parsed = projectUpsertSchema.parse(input);

  const data = {
    tenantId: session.user.tenantId,
    name: parsed.name,
    clientId: parsed.clientId,
    location: parsed.location?.trim() ? parsed.location.trim() : null,
    status: parsed.status,
    startDate: parseDateOnly(parsed.startDate),
    endDate: parseDateOnly(parsed.endDate),
    remarks: parsed.remarks?.trim() ? parsed.remarks.trim() : null,
  } as const;

  if (parsed.id) {
    await prisma.project.update({
      where: {
        id: parsed.id,
        tenantId: session.user.tenantId,
      },
      data,
    });
  } else {
    await prisma.project.create({ data });
  }

  revalidatePath("/app/projects");
}

export async function deleteProject(id: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  await prisma.project.delete({
    where: { id, tenantId: session.user.tenantId },
  });

  revalidatePath("/app/projects");
}

