"use server";

import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { z } from "zod";

import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

import { type ActionResult, unknownError, zodToFieldErrors } from "./_result";

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

      return sheet;
    });

    return { ok: true, data: { id: created.id } };
  } catch {
    return unknownError("Failed to save labour sheet.");
  }
}

