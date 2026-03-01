"use server";

import { getServerSession } from "next-auth/next";
import { z } from "zod";

import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

import { type ActionResult, unknownError, zodToFieldErrors } from "./_result";

function emptyToNull(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

const createClientContactSchema = z
  .object({
    clientId: z.string().min(1),
    name: z.string().min(1).max(200),
    role: z.preprocess(emptyToNull, z.string().max(200).nullable()),
    phone: z.preprocess(emptyToNull, z.string().max(50).nullable()),
    whatsapp: z.preprocess(emptyToNull, z.string().max(50).nullable()),
    email: z.preprocess(emptyToNull, z.string().email().max(200).nullable()),
    isPrimary: z.coerce.boolean().optional(),
    notes: z.preprocess(emptyToNull, z.string().max(2000).nullable()),
  })
  .strict();

const updateClientContactSchema = createClientContactSchema.extend({
  id: z.string().min(1),
});

export async function createClientContact(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } };

  const parsed = createClientContactSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION", message: "Invalid input", fieldErrors: zodToFieldErrors(parsed.error) } };
  }

  try {
    const res = await prisma.$transaction(async (tx) => {
      const client = await tx.client.findFirst({
        where: { tenantId: session.user.tenantId, id: parsed.data.clientId },
        select: { id: true },
      });
      if (!client) return { ok: false as const, code: "CLIENT_NOT_FOUND" as const };

      if (parsed.data.isPrimary) {
        await tx.clientContact.updateMany({
          where: { tenantId: session.user.tenantId, clientId: parsed.data.clientId, isPrimary: true },
          data: { isPrimary: false },
        });
      }

      const created = await tx.clientContact.create({
        data: {
          tenantId: session.user.tenantId,
          clientId: parsed.data.clientId,
          name: parsed.data.name.trim(),
          role: parsed.data.role,
          phone: parsed.data.phone,
          whatsapp: parsed.data.whatsapp,
          email: parsed.data.email,
          isPrimary: !!parsed.data.isPrimary,
          notes: parsed.data.notes,
        },
        select: { id: true },
      });
      return { ok: true as const, id: created.id };
    });

    if (!res.ok) {
      return { ok: false, error: { code: "NOT_FOUND", message: "Client not found." } };
    }

    return { ok: true, data: { id: res.id } };
  } catch {
    return unknownError("Failed to create contact.");
  }
}

export async function updateClientContact(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } };

  const parsed = updateClientContactSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION", message: "Invalid input", fieldErrors: zodToFieldErrors(parsed.error) } };
  }

  try {
    const res = await prisma.$transaction(async (tx) => {
      const existing = await tx.clientContact.findFirst({
        where: { tenantId: session.user.tenantId, id: parsed.data.id },
        select: { id: true, clientId: true },
      });
      if (!existing) return { ok: false as const, code: "NOT_FOUND" as const };
      if (existing.clientId !== parsed.data.clientId) return { ok: false as const, code: "CONFLICT" as const };

      if (parsed.data.isPrimary) {
        await tx.clientContact.updateMany({
          where: { tenantId: session.user.tenantId, clientId: parsed.data.clientId, isPrimary: true },
          data: { isPrimary: false },
        });
      }

      await tx.clientContact.update({
        where: { tenantId: session.user.tenantId, id: parsed.data.id },
        data: {
          name: parsed.data.name.trim(),
          role: parsed.data.role,
          phone: parsed.data.phone,
          whatsapp: parsed.data.whatsapp,
          email: parsed.data.email,
          isPrimary: !!parsed.data.isPrimary,
          notes: parsed.data.notes,
        },
        select: { id: true },
      });

      return { ok: true as const };
    });

    if (!res.ok) {
      if (res.code === "CONFLICT") return { ok: false, error: { code: "CONFLICT", message: "Contact belongs to a different client." } };
      return { ok: false, error: { code: "NOT_FOUND", message: "Contact not found." } };
    }

    return { ok: true, data: { id: parsed.data.id } };
  } catch {
    return unknownError("Failed to update contact.");
  }
}

export async function deleteClientContact(id: string): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } };

  try {
    const res = await prisma.clientContact.deleteMany({
      where: { tenantId: session.user.tenantId, id },
    });
    if (res.count === 0) return { ok: false, error: { code: "NOT_FOUND", message: "Contact not found." } };
    return { ok: true, data: { id } };
  } catch {
    return unknownError("Failed to delete contact.");
  }
}

export async function setPrimaryClientContact(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } };

  const parsed = z
    .object({ id: z.string().min(1), clientId: z.string().min(1) })
    .strict()
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION", message: "Invalid input", fieldErrors: zodToFieldErrors(parsed.error) } };
  }

  try {
    const res = await prisma.$transaction(async (tx) => {
      const contact = await tx.clientContact.findFirst({
        where: { tenantId: session.user.tenantId, id: parsed.data.id, clientId: parsed.data.clientId },
        select: { id: true },
      });
      if (!contact) return { ok: false as const };

      await tx.clientContact.updateMany({
        where: { tenantId: session.user.tenantId, clientId: parsed.data.clientId, isPrimary: true },
        data: { isPrimary: false },
      });
      await tx.clientContact.update({
        where: { tenantId: session.user.tenantId, id: parsed.data.id },
        data: { isPrimary: true },
        select: { id: true },
      });
      return { ok: true as const };
    });

    if (!res.ok) return { ok: false, error: { code: "NOT_FOUND", message: "Contact not found." } };
    return { ok: true, data: { id: parsed.data.id } };
  } catch {
    return unknownError("Failed to mark primary contact.");
  }
}

