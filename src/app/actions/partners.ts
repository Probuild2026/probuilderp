"use server";

import { PartnerRemunerationType, PartnerTdsStatus, PaymentMode, Prisma } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { z } from "zod";

import {
  PARTNER_DEFAULT_TDS_RATE,
  PARTNER_TDS_THRESHOLD,
  PARTNER_TDS_SECTION,
  computePartnerRemuneration,
  getFinancialYear,
  parseDateOnly,
} from "@/lib/partner-finance";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

import { type ActionResult, unknownError, zodToFieldErrors } from "./_result";

function emptyToUndefined(value: unknown) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
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

const remunerationSchema = z.object({
  partnerId: z.string().min(1),
  projectId: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  date: z.string().min(1),
  type: z.nativeEnum(PartnerRemunerationType),
  grossAmount: z.coerce.number().positive(),
  tdsRate: z.coerce.number().min(0).max(100).default(PARTNER_DEFAULT_TDS_RATE),
  paymentMode: z.preprocess(emptyToUndefined, z.nativeEnum(PaymentMode).optional()),
  paymentDate: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  note: z.preprocess(emptyToUndefined, z.string().trim().max(4000).optional()),
});

const drawingSchema = z.object({
  partnerId: z.string().min(1),
  projectId: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  date: z.string().min(1),
  amount: z.coerce.number().positive(),
  mode: z.nativeEnum(PaymentMode),
  note: z.preprocess(emptyToUndefined, z.string().trim().max(4000).optional()),
});

const tdsPaymentSchema = z.object({
  partnerId: z.string().min(1),
  fy: z.string().trim().min(4).max(9),
  section: z.preprocess(emptyToUndefined, z.string().trim().max(20).optional()),
  challanNo: z.preprocess(emptyToUndefined, z.string().trim().max(50).optional()),
  periodFrom: z.preprocess(emptyToUndefined, z.string().optional()),
  periodTo: z.preprocess(emptyToUndefined, z.string().optional()),
  tdsPaidAmount: z.coerce.number().positive(),
  paymentDate: z.string().min(1),
  note: z.preprocess(emptyToUndefined, z.string().trim().max(4000).optional()),
});

const projectProfitSchema = z.object({
  projectId: z.string().min(1),
  fy: z.string().trim().min(4).max(9),
  profitBeforePartner: z.coerce.number(),
});

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

    const existing = await prisma.partnerRemuneration.aggregate({
      where: { tenantId: session.user.tenantId, partnerId: parsed.data.partnerId, fy },
      _sum: { grossAmount: true },
    });

    const existingGross = Number(existing._sum.grossAmount ?? 0);
    const aggregateGross = existingGross + parsed.data.grossAmount;
    const thresholdCrossed = aggregateGross > PARTNER_TDS_THRESHOLD;
    const inputRate = Number(parsed.data.tdsRate ?? 0);
    const appliedRate = thresholdCrossed
      ? inputRate > 0
        ? inputRate
        : PARTNER_DEFAULT_TDS_RATE
      : 0;

    const computed = computePartnerRemuneration({
      grossAmount: parsed.data.grossAmount,
      fyGrossBeforeCurrent: existingGross,
      tdsRatePercent: appliedRate,
    });

    const created = await prisma.partnerRemuneration.create({
      data: {
        tenantId: session.user.tenantId,
        partnerId: parsed.data.partnerId,
        projectId: parsed.data.projectId ?? null,
        date,
        type: parsed.data.type,
        grossAmount: new Prisma.Decimal(parsed.data.grossAmount),
        tdsRate: computed.tdsRate,
        tdsAmount: computed.tdsAmount,
        netPayable: computed.netPayable,
        paymentMode: parsed.data.paymentMode ?? null,
        paymentDate: parsed.data.paymentDate ? parseDateOnly(parsed.data.paymentDate) : null,
        tdsStatus: computed.shouldDeduct ? PartnerTdsStatus.DEDUCTED_NOT_PAID : PartnerTdsStatus.NOT_APPLICABLE,
        fy,
        note: parsed.data.note ?? null,
      },
      select: { id: true },
    });

    return { ok: true, data: created };
  } catch {
    return unknownError("Failed to add remuneration.");
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
    const created = await prisma.partnerDrawing.create({
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
    return { ok: true, data: created };
  } catch {
    return unknownError("Failed to add drawing.");
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
    const created = await prisma.partnerTdsPayment.create({
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
    return { ok: true, data: created };
  } catch {
    return unknownError("Failed to record TDS payment.");
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
    return { ok: true, data: saved };
  } catch {
    return unknownError("Failed to update project profit allocation.");
  }
}
