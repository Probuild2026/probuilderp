"use server";

import { getServerSession } from "next-auth/next";
import { z } from "zod";

import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

import { type ActionResult, unknownError, zodToFieldErrors } from "./_result";

const projectCreateSchema = z.object({
  name: z.string().min(1).max(200),
  clientId: z.string().min(1),
  location: z.string().max(500).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.enum(["PLANNED", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"]).default("ACTIVE"),
  remarks: z.string().max(2000).optional(),
});

const projectUpdateSchema = projectCreateSchema.extend({
  id: z.string().min(1),
});

const projectListSchema = z.object({
  q: z.string().max(200).optional(),
  clientId: z.string().optional(),
  status: z.string().optional(),
  take: z.coerce.number().int().min(1).max(500).default(50),
  skip: z.coerce.number().int().min(0).default(0),
});

function parseDateOnly(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid date");
  return date;
}

function optionalDate(value?: string) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return parseDateOnly(trimmed);
}

export async function createProject(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } };

  const parsed = projectCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION", message: "Invalid input", fieldErrors: zodToFieldErrors(parsed.error) } };
  }

  try {
    const created = await prisma.project.create({
      data: {
        tenantId: session.user.tenantId,
        name: parsed.data.name.trim(),
        clientId: parsed.data.clientId,
        location: parsed.data.location?.trim() || null,
        startDate: optionalDate(parsed.data.startDate) as any,
        endDate: optionalDate(parsed.data.endDate) as any,
        status: parsed.data.status,
        remarks: parsed.data.remarks?.trim() || null,
      },
      select: { id: true },
    });
    return { ok: true, data: created };
  } catch {
    return unknownError("Failed to create project.");
  }
}

export async function updateProject(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } };

  const parsed = projectUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION", message: "Invalid input", fieldErrors: zodToFieldErrors(parsed.error) } };
  }

  try {
    const updated = await prisma.project.update({
      where: { id: parsed.data.id, tenantId: session.user.tenantId },
      data: {
        name: parsed.data.name.trim(),
        clientId: parsed.data.clientId,
        location: parsed.data.location?.trim() || null,
        startDate: optionalDate(parsed.data.startDate) as any,
        endDate: optionalDate(parsed.data.endDate) as any,
        status: parsed.data.status,
        remarks: parsed.data.remarks?.trim() || null,
      },
      select: { id: true },
    });
    return { ok: true, data: updated };
  } catch {
    return unknownError("Failed to update project.");
  }
}

export async function listProjects(
  input: unknown,
): Promise<ActionResult<{ items: Array<{ id: string; name: string; status: string; clientId: string }>; total: number }>> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } };

  const parsed = projectListSchema.safeParse(input ?? {});
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION", message: "Invalid input", fieldErrors: zodToFieldErrors(parsed.error) } };
  }

  const q = parsed.data.q?.trim();
  const where = {
    tenantId: session.user.tenantId,
    ...(parsed.data.clientId ? { clientId: parsed.data.clientId } : {}),
    ...(parsed.data.status ? { status: parsed.data.status as any } : {}),
    ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
  };

  try {
    const [items, total] = await prisma.$transaction([
      prisma.project.findMany({
        where,
        orderBy: { name: "asc" },
        take: parsed.data.take,
        skip: parsed.data.skip,
        select: { id: true, name: true, status: true, clientId: true },
      }),
      prisma.project.count({ where }),
    ]);
    return { ok: true, data: { items, total } };
  } catch {
    return unknownError("Failed to load projects.");
  }
}

