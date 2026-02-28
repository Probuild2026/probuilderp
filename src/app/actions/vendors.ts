"use server";

import { getServerSession } from "next-auth/next";
import { z } from "zod";

import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

import { type ActionResult, unknownError, zodToFieldErrors } from "./_result";

const vendorCreateSchema = z.object({
  name: z.string().min(1).max(200),
  trade: z.string().max(200).optional(),
  gstin: z.string().max(30).optional(),
  pan: z.string().max(30).optional(),
  phone: z.string().max(50).optional(),
  email: z.string().email().optional(),
  address: z.string().max(2000).optional(),
  isSubcontractor: z.coerce.boolean().optional(),
});

const vendorUpdateSchema = vendorCreateSchema.extend({
  id: z.string().min(1),
});

const vendorListSchema = z.object({
  q: z.string().max(200).optional(),
  trade: z.string().max(200).optional(),
  take: z.coerce.number().int().min(1).max(500).default(50),
  skip: z.coerce.number().int().min(0).default(0),
});

export async function createVendor(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } };

  const parsed = vendorCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION", message: "Invalid input", fieldErrors: zodToFieldErrors(parsed.error) } };
  }

  try {
    const created = await prisma.vendor.create({
      data: {
        tenantId: session.user.tenantId,
        name: parsed.data.name.trim(),
        trade: parsed.data.trade?.trim() || null,
        gstin: parsed.data.gstin?.trim() || null,
        pan: parsed.data.pan?.trim() || null,
        phone: parsed.data.phone?.trim() || null,
        email: parsed.data.email?.trim() || null,
        address: parsed.data.address?.trim() || null,
        isSubcontractor: !!parsed.data.isSubcontractor,
      },
      select: { id: true },
    });
    return { ok: true, data: created };
  } catch {
    return unknownError("Failed to create vendor.");
  }
}

export async function updateVendor(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } };

  const parsed = vendorUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION", message: "Invalid input", fieldErrors: zodToFieldErrors(parsed.error) } };
  }

  try {
    const updated = await prisma.vendor.update({
      where: { id: parsed.data.id, tenantId: session.user.tenantId },
      data: {
        name: parsed.data.name.trim(),
        trade: parsed.data.trade?.trim() || null,
        gstin: parsed.data.gstin?.trim() || null,
        pan: parsed.data.pan?.trim() || null,
        phone: parsed.data.phone?.trim() || null,
        email: parsed.data.email?.trim() || null,
        address: parsed.data.address?.trim() || null,
        isSubcontractor: !!parsed.data.isSubcontractor,
      },
      select: { id: true },
    });
    return { ok: true, data: updated };
  } catch {
    return unknownError("Failed to update vendor.");
  }
}

export async function listVendors(input: unknown): Promise<ActionResult<{ items: Array<{ id: string; name: string; trade: string | null }>; total: number }>> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } };

  const parsed = vendorListSchema.safeParse(input ?? {});
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION", message: "Invalid input", fieldErrors: zodToFieldErrors(parsed.error) } };
  }

  const q = parsed.data.q?.trim();
  const trade = parsed.data.trade?.trim();

  const where = {
    tenantId: session.user.tenantId,
    ...(trade ? { trade: { equals: trade, mode: "insensitive" as const } } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { gstin: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  try {
    const [items, total] = await prisma.$transaction([
      prisma.vendor.findMany({
        where,
        orderBy: { name: "asc" },
        take: parsed.data.take,
        skip: parsed.data.skip,
        select: { id: true, name: true, trade: true },
      }),
      prisma.vendor.count({ where }),
    ]);
    return { ok: true, data: { items, total } };
  } catch {
    return unknownError("Failed to load vendors.");
  }
}

