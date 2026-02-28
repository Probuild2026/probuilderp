"use server";

import { getServerSession } from "next-auth/next";
import { z } from "zod";

import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

import { type ActionResult, unknownError, zodToFieldErrors } from "./_result";

const clientCreateSchema = z.object({
  name: z.string().min(1).max(200),
  contactPerson: z.string().max(200).optional(),
  phone: z.string().max(50).optional(),
  email: z.string().email().optional(),
  billingAddress: z.string().max(2000).optional(),
  gstin: z.string().max(30).optional(),
  pan: z.string().max(30).optional(),
});

const clientUpdateSchema = clientCreateSchema.extend({
  id: z.string().min(1),
});

const clientListSchema = z.object({
  q: z.string().max(200).optional(),
  take: z.coerce.number().int().min(1).max(500).default(50),
  skip: z.coerce.number().int().min(0).default(0),
});

export async function createClient(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } };

  const parsed = clientCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION", message: "Invalid input", fieldErrors: zodToFieldErrors(parsed.error) } };
  }

  try {
    const created = await prisma.client.create({
      data: {
        tenantId: session.user.tenantId,
        name: parsed.data.name.trim(),
        contactPerson: parsed.data.contactPerson?.trim() || null,
        phone: parsed.data.phone?.trim() || null,
        email: parsed.data.email?.trim() || null,
        billingAddress: parsed.data.billingAddress?.trim() || null,
        gstin: parsed.data.gstin?.trim() || null,
        pan: parsed.data.pan?.trim() || null,
      },
      select: { id: true },
    });
    return { ok: true, data: created };
  } catch {
    return unknownError("Failed to create client.");
  }
}

export async function updateClient(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } };

  const parsed = clientUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION", message: "Invalid input", fieldErrors: zodToFieldErrors(parsed.error) } };
  }

  try {
    const updated = await prisma.client.update({
      where: { id: parsed.data.id, tenantId: session.user.tenantId },
      data: {
        name: parsed.data.name.trim(),
        contactPerson: parsed.data.contactPerson?.trim() || null,
        phone: parsed.data.phone?.trim() || null,
        email: parsed.data.email?.trim() || null,
        billingAddress: parsed.data.billingAddress?.trim() || null,
        gstin: parsed.data.gstin?.trim() || null,
        pan: parsed.data.pan?.trim() || null,
      },
      select: { id: true },
    });
    return { ok: true, data: updated };
  } catch {
    return unknownError("Failed to update client.");
  }
}

export async function listClients(input: unknown): Promise<ActionResult<{ items: Array<{ id: string; name: string; gstin: string | null }>; total: number }>> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } };

  const parsed = clientListSchema.safeParse(input ?? {});
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION", message: "Invalid input", fieldErrors: zodToFieldErrors(parsed.error) } };
  }

  const q = parsed.data.q?.trim();
  const where = {
    tenantId: session.user.tenantId,
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
      prisma.client.findMany({
        where,
        orderBy: { name: "asc" },
        take: parsed.data.take,
        skip: parsed.data.skip,
        select: { id: true, name: true, gstin: true },
      }),
      prisma.client.count({ where }),
    ]);

    return { ok: true, data: { items, total } };
  } catch {
    return unknownError("Failed to load clients.");
  }
}

