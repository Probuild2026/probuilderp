"use server";

import { PartnerRemunerationType, PartnerTdsStatus, PaymentMode, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth/next";
import { z } from "zod";

import {
  PARTNER_DEFAULT_TDS_RATE,
  PARTNER_TDS_SECTION,
  PARTNER_TDS_THRESHOLD,
  computePartnerRemuneration,
  getFinancialYear,
  parseDateOnly,
} from "@/lib/partner-finance";
import { authOptions } from "@/server/auth";
import { writeAuditLog } from "@/server/audit";
import { prisma } from "@/server/db";

import { type ActionResult, unknownError, zodToFieldErrors } from "./_result";

function emptyToUndefined(value: unknown) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

function partnerDetailPath(partnerId: string) {
  return `/app/partners/${partnerId}`;
}

const partnerSchema = z.object({
  name: z.string().trim().min(1).max(200),
  pan: z.preprocess(emptyToUndefined, z.string().trim().max(20).optional()),
  profitRatio: z.coerce.number().min(0).max(100),
  capitalContribution: z.coerce.number().min(0).optional(),
  isActive: z.coerce.boolean().default(true),
  notes: z.preprocess(emptyToUndefined, z.string().trim().max(4000).optional()),
});

const partnerUpdateSchema = partnerSchema.extend({
  id: z.string().min(1),
});

const remunerationSchema = z
  .object({
    partnerId: z.string().min(1),
    projectId: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
    date: z.string().min(1),
    type: z.nativeEnum(PartnerRemunerationType),
    grossAmount: z.coerce.number().positive(),
    tdsRate: z.coerce.number().min(0).max(100).default(PARTNER_DEFAULT_TDS_RATE),
    paymentMode: z.preprocess(emptyToUndefined, z.nativeEnum(PaymentMode).optional()),
    paymentDate: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
    note: z.preprocess(emptyToUndefined, z.string().trim().max(4000).optional()),
  })
  .strict();

const remunerationUpdateSchema = remunerationSchema.extend({
  id: z.string().min(1),
});

const drawingSchema = z
  .object({
    partnerId: z.string().min(1),
    projectId: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
    date: z.string().min(1),
    amount: z.coerce.number().positive(),
    mode: z.nativeEnum(PaymentMode),
    note: z.preprocess(emptyToUndefined, z.string().trim().max(4000).optional()),
  })
  .strict();

const drawingUpdateSchema = drawingSchema.extend({
  id: z.string().min(1),
});

const tdsPaymentSchema = z
  .object({
    partnerId: z.string().min(1),
    fy: z.string().trim().min(4).max(9),
    section: z.preprocess(emptyToUndefined, z.string().trim().max(20).optional()),
    challanNo: z.preprocess(emptyToUndefined, z.string().trim().max(50).optional()),
    periodFrom: z.preprocess(emptyToUndefined, z.string().optional()),
    periodTo: z.preprocess(emptyToUndefined, z.string().optional()),
    tdsPaidAmount: z.coerce.number().positive(),
    paymentDate: z.string().min(1),
    note: z.preprocess(emptyToUndefined, z.string().trim().max(4000).optional()),
  })
  .strict();

const tdsPaymentUpdateSchema = tdsPaymentSchema.extend({
  id: z.string().min(1),
});

const entryDeleteSchema = z
  .object({
    id: z.string().min(1),
    partnerId: z.string().min(1),
  })
  .strict();

const projectProfitSchema = z
  .object({
    projectId: z.string().min(1),
    fy: z.string().trim().min(4).max(9),
    profitBeforePartner: z.coerce.number(),
  })
  .strict();

type PartnerTx = Prisma.TransactionClient;

async function recalculatePartnerRemunerationForFy(
  tx: PartnerTx,
  input: { tenantId: number; partnerId: string; fy: string },
) {
  const rows = await tx.partnerRemuneration.findMany({
    where: {
      tenantId: input.tenantId,
      partnerId: input.partnerId,
      fy: input.fy,
    },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      grossAmount: true,
      tdsRate: true,
    },
  });

  let fyGrossBeforeCurrent = new Prisma.Decimal(0);

  for (const row of rows) {
    const aggregateGross = fyGrossBeforeCurrent.add(row.grossAmount);
    const thresholdCrossed = aggregateGross.gt(new Prisma.Decimal(PARTNER_TDS_THRESHOLD));
    const currentRate = Number(row.tdsRate ?? 0);
    const appliedRate = thresholdCrossed
      ? currentRate > 0
        ? currentRate
        : PARTNER_DEFAULT_TDS_RATE
      : 0;

    const computed = computePartnerRemuneration({
      grossAmount: row.grossAmount,
      fyGrossBeforeCurrent,
      tdsRatePercent: appliedRate,
    });

    await tx.partnerRemuneration.update({
      where: { id: row.id },
      data: {
        tdsRate: computed.tdsRate,
        tdsAmount: computed.tdsAmount,
        netPayable: computed.netPayable,
        tdsStatus: computed.shouldDeduct ? PartnerTdsStatus.DEDUCTED_NOT_PAID : PartnerTdsStatus.NOT_APPLICABLE,
      },
    });

    fyGrossBeforeCurrent = aggregateGross;
  }
}

async function syncProjectProfitAllocationTotals(
  tx: PartnerTx,
  input: { tenantId: number; projectId?: string | null; fy: string },
) {
  if (!input.projectId) return;

  const allocation = await tx.projectProfitAllocation.findUnique({
    where: {
      tenantId_projectId_fy: {
        tenantId: input.tenantId,
        projectId: input.projectId,
        fy: input.fy,
      },
    },
    select: {
      profitBeforePartner: true,
    },
  });

  if (!allocation) return;

  const remu = await tx.partnerRemuneration.aggregate({
    where: {
      tenantId: input.tenantId,
      projectId: input.projectId,
      fy: input.fy,
    },
    _sum: { grossAmount: true },
  });

  const totalRemu = remu._sum.grossAmount ?? new Prisma.Decimal(0);

  await tx.projectProfitAllocation.update({
    where: {
      tenantId_projectId_fy: {
        tenantId: input.tenantId,
        projectId: input.projectId,
        fy: input.fy,
      },
    },
    data: {
      totalPartnerRemu: totalRemu,
      profitAfterRemu: allocation.profitBeforePartner.sub(totalRemu),
    },
  });
}

function uniqueTargets<T>(items: T[], keyOf: (item: T) => string) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = keyOf(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function createPartner(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } };

  const parsed = partnerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION", message: "Invalid input", fieldErrors: zodToFieldErrors(parsed.error) } };
  }

  try {
    const created = await prisma.partner.create({
      data: {
        tenantId: session.user.tenantId,
        name: parsed.data.name,
        pan: parsed.data.pan ?? null,
        profitRatio: new Prisma.Decimal(parsed.data.profitRatio),
        capitalContribution:
          parsed.data.capitalContribution == null ? null : new Prisma.Decimal(parsed.data.capitalContribution),
        isActive: parsed.data.isActive,
        notes: parsed.data.notes ?? null,
      },
      select: { id: true },
    });
    return { ok: true, data: created };
  } catch {
    return unknownError("Failed to create partner.");
  }
}

export async function updatePartner(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } };

  const parsed = partnerUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION", message: "Invalid input", fieldErrors: zodToFieldErrors(parsed.error) } };
  }

  try {
    const updated = await prisma.partner.update({
      where: { id: parsed.data.id, tenantId: session.user.tenantId },
      data: {
        name: parsed.data.name,
        pan: parsed.data.pan ?? null,
        profitRatio: new Prisma.Decimal(parsed.data.profitRatio),
        capitalContribution:
          parsed.data.capitalContribution == null ? null : new Prisma.Decimal(parsed.data.capitalContribution),
        isActive: parsed.data.isActive,
        notes: parsed.data.notes ?? null,
      },
      select: { id: true },
    });
    return { ok: true, data: updated };
  } catch {
    return unknownError("Failed to update partner.");
  }
}

export async function createPartnerRemuneration(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } };

  const parsed = remunerationSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION", message: "Invalid input", fieldErrors: zodToFieldErrors(parsed.error) } };
  }

  try {
    const date = parseDateOnly(parsed.data.date);
    const fy = getFinancialYear(date);

    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.partnerRemuneration.create({
        data: {
          tenantId: session.user.tenantId,
          partnerId: parsed.data.partnerId,
          projectId: parsed.data.projectId ?? null,
          date,
          type: parsed.data.type,
          grossAmount: new Prisma.Decimal(parsed.data.grossAmount),
          tdsRate: new Prisma.Decimal(parsed.data.tdsRate),
          tdsAmount: new Prisma.Decimal(0),
          netPayable: new Prisma.Decimal(parsed.data.grossAmount),
          paymentMode: parsed.data.paymentMode ?? null,
          paymentDate: parsed.data.paymentDate ? parseDateOnly(parsed.data.paymentDate) : null,
          tdsStatus: PartnerTdsStatus.NOT_APPLICABLE,
          fy,
          note: parsed.data.note ?? null,
        },
        select: { id: true },
      });

      await recalculatePartnerRemunerationForFy(tx, {
        tenantId: session.user.tenantId,
        partnerId: parsed.data.partnerId,
        fy,
      });
      await syncProjectProfitAllocationTotals(tx, {
        tenantId: session.user.tenantId,
        projectId: parsed.data.projectId,
        fy,
      });

      await writeAuditLog(tx, {
        tenantId: session.user.tenantId,
        userId: session.user.id,
        userEmail: session.user.email,
        action: "CREATE",
        entityType: "PARTNER_REMUNERATION",
        entityId: row.id,
        summary: "Partner remuneration entry created.",
        metadata: {
          partnerId: parsed.data.partnerId,
          projectId: parsed.data.projectId ?? null,
          fy,
          grossAmount: parsed.data.grossAmount,
          type: parsed.data.type,
        },
      });

      return row;
    });

    revalidatePath(partnerDetailPath(parsed.data.partnerId));
    return { ok: true, data: created };
  } catch {
    return unknownError("Failed to add remuneration.");
  }
}

export async function updatePartnerRemuneration(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } };

  const parsed = remunerationUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION", message: "Invalid input", fieldErrors: zodToFieldErrors(parsed.error) } };
  }

  try {
    const date = parseDateOnly(parsed.data.date);
    const newFy = getFinancialYear(date);

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.partnerRemuneration.findFirst({
        where: {
          id: parsed.data.id,
          tenantId: session.user.tenantId,
        },
        select: {
          id: true,
          partnerId: true,
          projectId: true,
          fy: true,
        },
      });

      if (!existing) return null;

      await tx.partnerRemuneration.update({
        where: { id: existing.id },
        data: {
          partnerId: parsed.data.partnerId,
          projectId: parsed.data.projectId ?? null,
          date,
          type: parsed.data.type,
          grossAmount: new Prisma.Decimal(parsed.data.grossAmount),
          tdsRate: new Prisma.Decimal(parsed.data.tdsRate),
          paymentMode: parsed.data.paymentMode ?? null,
          paymentDate: parsed.data.paymentDate ? parseDateOnly(parsed.data.paymentDate) : null,
          fy: newFy,
          note: parsed.data.note ?? null,
        },
      });

      for (const target of uniqueTargets(
        [
          { partnerId: existing.partnerId, fy: existing.fy },
          { partnerId: parsed.data.partnerId, fy: newFy },
        ],
        (item) => `${item.partnerId}:${item.fy}`,
      )) {
        await recalculatePartnerRemunerationForFy(tx, {
          tenantId: session.user.tenantId,
          partnerId: target.partnerId,
          fy: target.fy,
        });
      }

      for (const target of uniqueTargets(
        [
          { projectId: existing.projectId, fy: existing.fy },
          { projectId: parsed.data.projectId ?? null, fy: newFy },
        ],
        (item) => `${item.projectId ?? ""}:${item.fy}`,
      )) {
        await syncProjectProfitAllocationTotals(tx, {
          tenantId: session.user.tenantId,
          projectId: target.projectId,
          fy: target.fy,
        });
      }

      await writeAuditLog(tx, {
        tenantId: session.user.tenantId,
        userId: session.user.id,
        userEmail: session.user.email,
        action: "UPDATE",
        entityType: "PARTNER_REMUNERATION",
        entityId: existing.id,
        summary: "Partner remuneration entry updated.",
        metadata: {
          partnerId: parsed.data.partnerId,
          previousPartnerId: existing.partnerId,
          projectId: parsed.data.projectId ?? null,
          previousProjectId: existing.projectId ?? null,
          fy: newFy,
          previousFy: existing.fy,
          grossAmount: parsed.data.grossAmount,
          type: parsed.data.type,
        },
      });

      return {
        id: existing.id,
        previousPartnerId: existing.partnerId,
      };
    });

    if (!result) {
      return { ok: false, error: { code: "NOT_FOUND", message: "Remuneration entry not found." } };
    }

    revalidatePath(partnerDetailPath(parsed.data.partnerId));
    if (result.previousPartnerId !== parsed.data.partnerId) {
      revalidatePath(partnerDetailPath(result.previousPartnerId));
    }

    return { ok: true, data: { id: result.id } };
  } catch {
    return unknownError("Failed to update remuneration.");
  }
}

export async function deletePartnerRemuneration(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } };

  const parsed = entryDeleteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION", message: "Invalid input", fieldErrors: zodToFieldErrors(parsed.error) } };
  }

  try {
    const deleted = await prisma.$transaction(async (tx) => {
      const existing = await tx.partnerRemuneration.findFirst({
        where: {
          id: parsed.data.id,
          tenantId: session.user.tenantId,
          partnerId: parsed.data.partnerId,
        },
        select: {
          id: true,
          partnerId: true,
          projectId: true,
          fy: true,
          grossAmount: true,
          type: true,
        },
      });

      if (!existing) return null;

      await tx.partnerRemuneration.delete({
        where: { id: existing.id },
      });

      await recalculatePartnerRemunerationForFy(tx, {
        tenantId: session.user.tenantId,
        partnerId: existing.partnerId,
        fy: existing.fy,
      });
      await syncProjectProfitAllocationTotals(tx, {
        tenantId: session.user.tenantId,
        projectId: existing.projectId,
        fy: existing.fy,
      });

      await writeAuditLog(tx, {
        tenantId: session.user.tenantId,
        userId: session.user.id,
        userEmail: session.user.email,
        action: "DELETE",
        entityType: "PARTNER_REMUNERATION",
        entityId: existing.id,
        summary: "Partner remuneration entry deleted.",
        metadata: {
          partnerId: existing.partnerId,
          projectId: existing.projectId ?? null,
          fy: existing.fy,
          grossAmount: Number(existing.grossAmount),
          type: existing.type,
        },
      });

      return { id: existing.id };
    });

    if (!deleted) {
      return { ok: false, error: { code: "NOT_FOUND", message: "Remuneration entry not found." } };
    }

    revalidatePath(partnerDetailPath(parsed.data.partnerId));
    return { ok: true, data: deleted };
  } catch {
    return unknownError("Failed to delete remuneration.");
  }
}

export async function createPartnerDrawing(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } };

  const parsed = drawingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION", message: "Invalid input", fieldErrors: zodToFieldErrors(parsed.error) } };
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.partnerDrawing.create({
        data: {
          tenantId: session.user.tenantId,
          partnerId: parsed.data.partnerId,
          projectId: parsed.data.projectId ?? null,
          date: parseDateOnly(parsed.data.date),
          amount: new Prisma.Decimal(parsed.data.amount),
          mode: parsed.data.mode,
          note: parsed.data.note ?? null,
        },
        select: { id: true },
      });

      await writeAuditLog(tx, {
        tenantId: session.user.tenantId,
        userId: session.user.id,
        userEmail: session.user.email,
        action: "CREATE",
        entityType: "PARTNER_DRAWING",
        entityId: row.id,
        summary: "Partner drawing entry created.",
        metadata: {
          partnerId: parsed.data.partnerId,
          projectId: parsed.data.projectId ?? null,
          amount: parsed.data.amount,
          mode: parsed.data.mode,
        },
      });

      return row;
    });

    revalidatePath(partnerDetailPath(parsed.data.partnerId));
    return { ok: true, data: created };
  } catch {
    return unknownError("Failed to add drawing.");
  }
}

export async function updatePartnerDrawing(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } };

  const parsed = drawingUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION", message: "Invalid input", fieldErrors: zodToFieldErrors(parsed.error) } };
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.partnerDrawing.findFirst({
        where: {
          id: parsed.data.id,
          tenantId: session.user.tenantId,
        },
        select: {
          id: true,
          partnerId: true,
          projectId: true,
        },
      });

      if (!existing) return null;

      await tx.partnerDrawing.update({
        where: { id: existing.id },
        data: {
          partnerId: parsed.data.partnerId,
          projectId: parsed.data.projectId ?? null,
          date: parseDateOnly(parsed.data.date),
          amount: new Prisma.Decimal(parsed.data.amount),
          mode: parsed.data.mode,
          note: parsed.data.note ?? null,
        },
      });

      await writeAuditLog(tx, {
        tenantId: session.user.tenantId,
        userId: session.user.id,
        userEmail: session.user.email,
        action: "UPDATE",
        entityType: "PARTNER_DRAWING",
        entityId: existing.id,
        summary: "Partner drawing entry updated.",
        metadata: {
          partnerId: parsed.data.partnerId,
          previousPartnerId: existing.partnerId,
          projectId: parsed.data.projectId ?? null,
          previousProjectId: existing.projectId ?? null,
          amount: parsed.data.amount,
          mode: parsed.data.mode,
        },
      });

      return {
        id: existing.id,
        previousPartnerId: existing.partnerId,
      };
    });

    if (!updated) {
      return { ok: false, error: { code: "NOT_FOUND", message: "Drawing entry not found." } };
    }

    revalidatePath(partnerDetailPath(parsed.data.partnerId));
    if (updated.previousPartnerId !== parsed.data.partnerId) {
      revalidatePath(partnerDetailPath(updated.previousPartnerId));
    }

    return { ok: true, data: { id: updated.id } };
  } catch {
    return unknownError("Failed to update drawing.");
  }
}

export async function deletePartnerDrawing(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } };

  const parsed = entryDeleteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION", message: "Invalid input", fieldErrors: zodToFieldErrors(parsed.error) } };
  }

  try {
    const deleted = await prisma.$transaction(async (tx) => {
      const existing = await tx.partnerDrawing.findFirst({
        where: {
          id: parsed.data.id,
          tenantId: session.user.tenantId,
          partnerId: parsed.data.partnerId,
        },
        select: {
          id: true,
          partnerId: true,
          projectId: true,
          amount: true,
          mode: true,
        },
      });

      if (!existing) return null;

      await tx.partnerDrawing.delete({
        where: { id: existing.id },
      });

      await writeAuditLog(tx, {
        tenantId: session.user.tenantId,
        userId: session.user.id,
        userEmail: session.user.email,
        action: "DELETE",
        entityType: "PARTNER_DRAWING",
        entityId: existing.id,
        summary: "Partner drawing entry deleted.",
        metadata: {
          partnerId: existing.partnerId,
          projectId: existing.projectId ?? null,
          amount: Number(existing.amount),
          mode: existing.mode,
        },
      });

      return { id: existing.id };
    });

    if (!deleted) {
      return { ok: false, error: { code: "NOT_FOUND", message: "Drawing entry not found." } };
    }

    revalidatePath(partnerDetailPath(parsed.data.partnerId));
    return { ok: true, data: deleted };
  } catch {
    return unknownError("Failed to delete drawing.");
  }
}

export async function createPartnerTdsPayment(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } };

  const parsed = tdsPaymentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION", message: "Invalid input", fieldErrors: zodToFieldErrors(parsed.error) } };
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.partnerTdsPayment.create({
        data: {
          tenantId: session.user.tenantId,
          partnerId: parsed.data.partnerId,
          fy: parsed.data.fy,
          section: parsed.data.section ?? PARTNER_TDS_SECTION,
          challanNo: parsed.data.challanNo ?? null,
          periodFrom: parsed.data.periodFrom ? parseDateOnly(parsed.data.periodFrom) : null,
          periodTo: parsed.data.periodTo ? parseDateOnly(parsed.data.periodTo) : null,
          tdsPaidAmount: new Prisma.Decimal(parsed.data.tdsPaidAmount),
          paymentDate: parseDateOnly(parsed.data.paymentDate),
          note: parsed.data.note ?? null,
        },
        select: { id: true },
      });

      await writeAuditLog(tx, {
        tenantId: session.user.tenantId,
        userId: session.user.id,
        userEmail: session.user.email,
        action: "CREATE",
        entityType: "PARTNER_TDS_PAYMENT",
        entityId: row.id,
        summary: "Partner TDS payment recorded.",
        metadata: {
          partnerId: parsed.data.partnerId,
          fy: parsed.data.fy,
          section: parsed.data.section ?? PARTNER_TDS_SECTION,
          tdsPaidAmount: parsed.data.tdsPaidAmount,
          paymentDate: parsed.data.paymentDate,
        },
      });

      return row;
    });

    revalidatePath(partnerDetailPath(parsed.data.partnerId));
    return { ok: true, data: created };
  } catch {
    return unknownError("Failed to record TDS payment.");
  }
}

export async function updatePartnerTdsPayment(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } };

  const parsed = tdsPaymentUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION", message: "Invalid input", fieldErrors: zodToFieldErrors(parsed.error) } };
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.partnerTdsPayment.findFirst({
        where: {
          id: parsed.data.id,
          tenantId: session.user.tenantId,
        },
        select: {
          id: true,
          partnerId: true,
          fy: true,
        },
      });

      if (!existing) return null;

      await tx.partnerTdsPayment.update({
        where: { id: existing.id },
        data: {
          partnerId: parsed.data.partnerId,
          fy: parsed.data.fy,
          section: parsed.data.section ?? PARTNER_TDS_SECTION,
          challanNo: parsed.data.challanNo ?? null,
          periodFrom: parsed.data.periodFrom ? parseDateOnly(parsed.data.periodFrom) : null,
          periodTo: parsed.data.periodTo ? parseDateOnly(parsed.data.periodTo) : null,
          tdsPaidAmount: new Prisma.Decimal(parsed.data.tdsPaidAmount),
          paymentDate: parseDateOnly(parsed.data.paymentDate),
          note: parsed.data.note ?? null,
        },
      });

      await writeAuditLog(tx, {
        tenantId: session.user.tenantId,
        userId: session.user.id,
        userEmail: session.user.email,
        action: "UPDATE",
        entityType: "PARTNER_TDS_PAYMENT",
        entityId: existing.id,
        summary: "Partner TDS payment updated.",
        metadata: {
          partnerId: parsed.data.partnerId,
          previousPartnerId: existing.partnerId,
          fy: parsed.data.fy,
          previousFy: existing.fy,
          section: parsed.data.section ?? PARTNER_TDS_SECTION,
          tdsPaidAmount: parsed.data.tdsPaidAmount,
          paymentDate: parsed.data.paymentDate,
        },
      });

      return {
        id: existing.id,
        previousPartnerId: existing.partnerId,
      };
    });

    if (!updated) {
      return { ok: false, error: { code: "NOT_FOUND", message: "TDS payment entry not found." } };
    }

    revalidatePath(partnerDetailPath(parsed.data.partnerId));
    if (updated.previousPartnerId !== parsed.data.partnerId) {
      revalidatePath(partnerDetailPath(updated.previousPartnerId));
    }

    return { ok: true, data: { id: updated.id } };
  } catch {
    return unknownError("Failed to update TDS payment.");
  }
}

export async function deletePartnerTdsPayment(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } };

  const parsed = entryDeleteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION", message: "Invalid input", fieldErrors: zodToFieldErrors(parsed.error) } };
  }

  try {
    const deleted = await prisma.$transaction(async (tx) => {
      const existing = await tx.partnerTdsPayment.findFirst({
        where: {
          id: parsed.data.id,
          tenantId: session.user.tenantId,
          partnerId: parsed.data.partnerId,
        },
        select: {
          id: true,
          partnerId: true,
          fy: true,
          section: true,
          tdsPaidAmount: true,
          paymentDate: true,
        },
      });

      if (!existing) return null;

      await tx.partnerTdsPayment.delete({
        where: { id: existing.id },
      });

      await writeAuditLog(tx, {
        tenantId: session.user.tenantId,
        userId: session.user.id,
        userEmail: session.user.email,
        action: "DELETE",
        entityType: "PARTNER_TDS_PAYMENT",
        entityId: existing.id,
        summary: "Partner TDS payment deleted.",
        metadata: {
          partnerId: existing.partnerId,
          fy: existing.fy,
          section: existing.section,
          tdsPaidAmount: Number(existing.tdsPaidAmount),
          paymentDate: existing.paymentDate.toISOString().slice(0, 10),
        },
      });

      return { id: existing.id };
    });

    if (!deleted) {
      return { ok: false, error: { code: "NOT_FOUND", message: "TDS payment entry not found." } };
    }

    revalidatePath(partnerDetailPath(parsed.data.partnerId));
    return { ok: true, data: deleted };
  } catch {
    return unknownError("Failed to delete TDS payment.");
  }
}

export async function upsertProjectProfitAllocation(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } };

  const parsed = projectProfitSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION", message: "Invalid input", fieldErrors: zodToFieldErrors(parsed.error) } };
  }

  try {
    const remu = await prisma.partnerRemuneration.aggregate({
      where: {
        tenantId: session.user.tenantId,
        projectId: parsed.data.projectId,
        fy: parsed.data.fy,
      },
      _sum: { grossAmount: true },
    });
    const totalRemu = Number(remu._sum.grossAmount ?? 0);
    const profitBefore = parsed.data.profitBeforePartner;
    const profitAfter = profitBefore - totalRemu;

    const saved = await prisma.projectProfitAllocation.upsert({
      where: {
        tenantId_projectId_fy: {
          tenantId: session.user.tenantId,
          projectId: parsed.data.projectId,
          fy: parsed.data.fy,
        },
      },
      update: {
        profitBeforePartner: new Prisma.Decimal(profitBefore),
        totalPartnerRemu: new Prisma.Decimal(totalRemu),
        profitAfterRemu: new Prisma.Decimal(profitAfter),
      },
      create: {
        tenantId: session.user.tenantId,
        projectId: parsed.data.projectId,
        fy: parsed.data.fy,
        profitBeforePartner: new Prisma.Decimal(profitBefore),
        totalPartnerRemu: new Prisma.Decimal(totalRemu),
        profitAfterRemu: new Prisma.Decimal(profitAfter),
      },
      select: { id: true },
    });

    await writeAuditLog(prisma, {
      tenantId: session.user.tenantId,
      userId: session.user.id,
      userEmail: session.user.email,
      action: "UPSERT",
      entityType: "PROJECT_PROFIT_ALLOCATION",
      entityId: saved.id,
      summary: "Project profit allocation updated.",
      metadata: {
        projectId: parsed.data.projectId,
        fy: parsed.data.fy,
        profitBeforePartner: profitBefore,
        totalPartnerRemu: totalRemu,
        profitAfterRemu: profitAfter,
      },
    });

    return { ok: true, data: saved };
  } catch {
    return unknownError("Failed to update project profit allocation.");
  }
}
