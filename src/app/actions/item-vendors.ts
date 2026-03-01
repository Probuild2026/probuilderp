"use server";

import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { z } from "zod";

import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

import { type ActionResult, unknownError, zodToFieldErrors } from "./_result";

const linkSchema = z.object({ itemId: z.string().min(1), vendorId: z.string().min(1) }).strict();

export async function linkItemVendor(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } };

  const parsed = linkSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION", message: "Invalid input", fieldErrors: zodToFieldErrors(parsed.error) } };
  }

  try {
    const created = await prisma.itemVendor.create({
      data: {
        tenantId: session.user.tenantId,
        itemId: parsed.data.itemId,
        vendorId: parsed.data.vendorId,
      },
      select: { id: true },
    });
    return { ok: true, data: created };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const existing = await prisma.itemVendor.findFirst({
        where: { tenantId: session.user.tenantId, itemId: parsed.data.itemId, vendorId: parsed.data.vendorId },
        select: { id: true },
      });
      if (existing) return { ok: true, data: { id: existing.id } };
    }
    return unknownError("Failed to link vendor.");
  }
}

export async function unlinkItemVendor(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } };

  const parsed = linkSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION", message: "Invalid input", fieldErrors: zodToFieldErrors(parsed.error) } };
  }

  try {
    const res = await prisma.itemVendor.deleteMany({
      where: { tenantId: session.user.tenantId, itemId: parsed.data.itemId, vendorId: parsed.data.vendorId },
    });
    if (res.count === 0) return { ok: false, error: { code: "NOT_FOUND", message: "Link not found." } };
    return { ok: true, data: { id: `${parsed.data.itemId}:${parsed.data.vendorId}` } };
  } catch {
    return unknownError("Failed to unlink vendor.");
  }
}

