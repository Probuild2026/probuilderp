"use server";

import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { z } from "zod";

import { authOptions } from "@/server/auth";
import { writeAuditLog } from "@/server/audit";
import { prisma } from "@/server/db";

import { type ActionResult, unknownError, zodToFieldErrors } from "./_result";
import { revalidatePath } from "next/cache";

const lineSchema = z
  .object({
    role: z.string().min(1).max(100),
    headcount: z.coerce.number().int().min(1).max(500),
    rate: z.coerce.number().min(0),
  })
  .strict();

const createLabourSheetSchema = z
  .object({
    projectId: z.string().min(1),
    date: z.string().min(1),
    mode: z.enum(["CASH", "BANK_TRANSFER", "CHEQUE", "UPI", "CARD", "OTHER"]),
    reference: z.string().max(200).optional(),
    note: z.string().max(2000).optional(),
    lines: z.array(lineSchema).min(1),
  })
  .strict();

const updateLabourSheetSchema = createLabourSheetSchema.extend({
  id: z.string().min(1),
});

function parseDateOnly(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid date");
  return date;
}

function financeTypeForMode(mode: "CASH" | "BANK_TRANSFER" | "CHEQUE" | "UPI" | "CARD" | "OTHER") {
  if (mode === "CASH") return "CASH" as const;
  if (mode === "UPI") return "UPI" as const;
  if (mode === "CARD") return "CARD" as const;
  if (mode === "BANK_TRANSFER" || mode === "CHEQUE") return "BANK" as const;
  return "OTHER" as const;
}

export async function createLabourSheet(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } };

  const parsed = createLabourSheetSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION", message: "Invalid input", fieldErrors: zodToFieldErrors(parsed.error) } };
  }

  try {
    const total = parsed.data.lines.reduce((acc, l) => acc + l.headcount * l.rate, 0);
    const totalDec = new Prisma.Decimal(total).toDecimalPlaces(2);

    const created = await prisma.$transaction(async (tx) => {
      const category = await tx.txnCategory.findFirst({
        where: { tenantId: session.user.tenantId, type: "EXPENSE", name: "Labour Payment" },
        select: { id: true },
      });

      const financeType = financeTypeForMode(parsed.data.mode);
      const fromAccount = await tx.financeAccount.findFirst({
        where: { tenantId: session.user.tenantId, type: financeType, active: true },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });

      const txn = await tx.transaction.create({
        data: {
          tenantId: session.user.tenantId,
          type: "EXPENSE",
          date: parseDateOnly(parsed.data.date),
          amount: totalDec,
          tdsAmount: new Prisma.Decimal(0),
          tdsBaseAmount: new Prisma.Decimal(0),
          projectId: parsed.data.projectId,
          categoryId: category?.id ?? null,
          fromAccountId: fromAccount?.id ?? null,
          mode: parsed.data.mode,
          reference: parsed.data.reference?.trim() || null,
          note: parsed.data.note?.trim() || null,
          description: null,
        },
        select: { id: true },
      });

      const sheet = await tx.labourSheet.create({
        data: {
          tenantId: session.user.tenantId,
          projectId: parsed.data.projectId,
          date: parseDateOnly(parsed.data.date),
          mode: parsed.data.mode,
          reference: parsed.data.reference?.trim() || null,
          note: parsed.data.note?.trim() || null,
          total: totalDec,
          transactionId: txn.id,
          lines: {
            create: parsed.data.lines.map((l) => ({
              tenantId: session.user.tenantId,
              role: l.role.trim(),
              headcount: l.headcount,
              rate: new Prisma.Decimal(l.rate).toDecimalPlaces(2),
              amount: new Prisma.Decimal(l.headcount * l.rate).toDecimalPlaces(2),
            })),
          },
        },
        select: { id: true },
      });

      await writeAuditLog(tx, {
        tenantId: session.user.tenantId,
        userId: session.user.id,
        userEmail: session.user.email,
        action: "CREATE",
        entityType: "WAGE_SHEET",
        entityId: sheet.id,
        summary: "Wage sheet created.",
        metadata: {
          projectId: parsed.data.projectId,
          total,
          mode: parsed.data.mode,
          lineCount: parsed.data.lines.length,
        },
      });

      return sheet;
    });

    return { ok: true, data: { id: created.id } };
  } catch {
    return unknownError("Failed to save labour sheet.");
  }
}

export async function updateLabourSheet(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } };

  const parsed = updateLabourSheetSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION", message: "Invalid input", fieldErrors: zodToFieldErrors(parsed.error) } };
  }

  try {
    const total = parsed.data.lines.reduce((acc, l) => acc + l.headcount * l.rate, 0);
    const totalDec = new Prisma.Decimal(total).toDecimalPlaces(2);
    const financeType = financeTypeForMode(parsed.data.mode);

    const res = await prisma.$transaction(async (tx) => {
      const sheet = await tx.labourSheet.findFirst({
        where: { tenantId: session.user.tenantId, id: parsed.data.id },
        select: { id: true, transactionId: true },
      });
      if (!sheet) return { ok: false as const, code: "NOT_FOUND" as const };

      const category = await tx.txnCategory.findFirst({
        where: { tenantId: session.user.tenantId, type: "EXPENSE", name: "Labour Payment" },
        select: { id: true },
      });

      const fromAccount = await tx.financeAccount.findFirst({
        where: { tenantId: session.user.tenantId, type: financeType, active: true },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });

      const date = parseDateOnly(parsed.data.date);

      const txnId =
        sheet.transactionId ??
        (
          await tx.transaction.create({
            data: {
              tenantId: session.user.tenantId,
              type: "EXPENSE",
              date,
              amount: totalDec,
              tdsAmount: new Prisma.Decimal(0),
              tdsBaseAmount: new Prisma.Decimal(0),
              projectId: parsed.data.projectId,
              categoryId: category?.id ?? null,
              fromAccountId: fromAccount?.id ?? null,
              mode: parsed.data.mode,
              reference: parsed.data.reference?.trim() || null,
              note: parsed.data.note?.trim() || null,
              description: null,
            },
            select: { id: true },
          })
        ).id;

      await tx.transaction.updateMany({
        where: { tenantId: session.user.tenantId, id: txnId },
        data: {
          date,
          amount: totalDec,
          projectId: parsed.data.projectId,
          categoryId: category?.id ?? null,
          fromAccountId: fromAccount?.id ?? null,
          mode: parsed.data.mode,
          reference: parsed.data.reference?.trim() || null,
          note: parsed.data.note?.trim() || null,
        },
      });

      await tx.labourSheet.updateMany({
        where: { tenantId: session.user.tenantId, id: parsed.data.id },
        data: {
          projectId: parsed.data.projectId,
          date,
          mode: parsed.data.mode,
          reference: parsed.data.reference?.trim() || null,
          note: parsed.data.note?.trim() || null,
          total: totalDec,
          transactionId: txnId,
        },
      });

      await tx.labourSheetLine.deleteMany({
        where: { tenantId: session.user.tenantId, labourSheetId: parsed.data.id },
      });
      await tx.labourSheetLine.createMany({
        data: parsed.data.lines.map((l) => ({
          tenantId: session.user.tenantId,
          labourSheetId: parsed.data.id,
          role: l.role.trim(),
          headcount: l.headcount,
          rate: new Prisma.Decimal(l.rate).toDecimalPlaces(2),
          amount: new Prisma.Decimal(l.headcount * l.rate).toDecimalPlaces(2),
        })),
      });

      await writeAuditLog(tx, {
        tenantId: session.user.tenantId,
        userId: session.user.id,
        userEmail: session.user.email,
        action: "UPDATE",
        entityType: "WAGE_SHEET",
        entityId: parsed.data.id,
        summary: "Wage sheet updated.",
        metadata: {
          projectId: parsed.data.projectId,
          total,
          mode: parsed.data.mode,
          lineCount: parsed.data.lines.length,
        },
      });

      return { ok: true as const };
    });

    if (!res.ok) return { ok: false, error: { code: "NOT_FOUND", message: "Labour sheet not found." } };

    revalidatePath("/app/wages");
    revalidatePath("/app/transactions");
    revalidatePath(`/app/wages/${parsed.data.id}`);

    return { ok: true, data: { id: parsed.data.id } };
  } catch {
    return unknownError("Failed to update labour sheet.");
  }
}

export async function deleteLabourSheet(id: string): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } };

  try {
    await prisma.$transaction(async (tx) => {
      const sheet = await tx.labourSheet.findFirst({
        where: { tenantId: session.user.tenantId, id },
        select: { id: true, transactionId: true, projectId: true, total: true },
      });
      if (!sheet) return;

      await writeAuditLog(tx, {
        tenantId: session.user.tenantId,
        userId: session.user.id,
        userEmail: session.user.email,
        action: "DELETE",
        entityType: "WAGE_SHEET",
        entityId: sheet.id,
        summary: "Wage sheet deleted.",
        metadata: {
          projectId: sheet.projectId,
          total: Number(sheet.total),
        },
      });

      await tx.labourSheetLine.deleteMany({ where: { tenantId: session.user.tenantId, labourSheetId: id } });
      await tx.labourSheet.deleteMany({ where: { tenantId: session.user.tenantId, id } });

      if (sheet.transactionId) {
        await tx.attachment.deleteMany({
          where: { tenantId: session.user.tenantId, entityType: "TRANSACTION", entityId: sheet.transactionId },
        });
        await tx.transaction.deleteMany({ where: { tenantId: session.user.tenantId, id: sheet.transactionId } });
      }
    });

    revalidatePath("/app/wages");
    revalidatePath("/app/transactions");

    return { ok: true, data: { id } };
  } catch {
    return unknownError("Failed to delete labour sheet.");
  }
}
