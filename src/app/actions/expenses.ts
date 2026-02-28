"use server";

import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { z } from "zod";

import { calcExpenseBalance, calcExpensePaidAmount, calcExpenseStatus } from "@/lib/finance";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

import { type ActionResult, unknownError, zodToFieldErrors } from "./_result";

const expenseCreateSchema = z.object({
  projectId: z.string().min(1),
  vendorId: z.string().optional(),
  labourerId: z.string().optional(),
  date: z.string().min(1),
  amountBeforeTax: z.coerce.number().nonnegative(),
  cgst: z.coerce.number().nonnegative().optional(),
  sgst: z.coerce.number().nonnegative().optional(),
  igst: z.coerce.number().nonnegative().optional(),
  paymentMode: z.enum(["CASH", "BANK_TRANSFER", "CHEQUE", "UPI", "CARD", "OTHER"]).optional(),
  paymentStatus: z.string().max(50).optional(),
  narration: z.string().max(5000).optional(),
  expenseType: z.enum(["MATERIAL", "LABOUR", "SUBCONTRACTOR", "OVERHEAD"]),
});

const expenseUpdateSchema = expenseCreateSchema.extend({
  id: z.string().min(1),
});

const expenseListSchema = z.object({
  projectId: z.string().optional(),
  vendorId: z.string().optional(),
  labourerId: z.string().optional(),
  expenseType: z.string().optional(),
  take: z.coerce.number().int().min(1).max(500).default(50),
  skip: z.coerce.number().int().min(0).default(0),
});

function parseDateOnly(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid date");
  return date;
}

export async function createExpense(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } };

  const parsed = expenseCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION", message: "Invalid input", fieldErrors: zodToFieldErrors(parsed.error) } };
  }

  try {
    const created = await prisma.expense.create({
      data: {
        tenantId: session.user.tenantId,
        projectId: parsed.data.projectId,
        vendorId: parsed.data.vendorId?.trim() || null,
        labourerId: parsed.data.labourerId?.trim() || null,
        date: parseDateOnly(parsed.data.date),
        amountBeforeTax: new Prisma.Decimal(parsed.data.amountBeforeTax),
        cgst: new Prisma.Decimal(parsed.data.cgst ?? 0),
        sgst: new Prisma.Decimal(parsed.data.sgst ?? 0),
        igst: new Prisma.Decimal(parsed.data.igst ?? 0),
        totalAmount: new Prisma.Decimal(parsed.data.amountBeforeTax)
          .add(new Prisma.Decimal(parsed.data.cgst ?? 0))
          .add(new Prisma.Decimal(parsed.data.sgst ?? 0))
          .add(new Prisma.Decimal(parsed.data.igst ?? 0)),
        paymentMode: parsed.data.paymentMode ?? null,
        paymentStatus: parsed.data.paymentStatus?.trim() || (parsed.data.paymentMode ? "PAID" : "UNPAID"),
        narration: parsed.data.narration?.trim() || null,
        expenseType: parsed.data.expenseType,
      },
      select: { id: true },
    });

    return { ok: true, data: created };
  } catch {
    return unknownError("Failed to create expense.");
  }
}

export async function updateExpense(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } };

  const parsed = expenseUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION", message: "Invalid input", fieldErrors: zodToFieldErrors(parsed.error) } };
  }

  try {
    const updated = await prisma.expense.update({
      where: { id: parsed.data.id, tenantId: session.user.tenantId },
      data: {
        projectId: parsed.data.projectId,
        vendorId: parsed.data.vendorId?.trim() || null,
        labourerId: parsed.data.labourerId?.trim() || null,
        date: parseDateOnly(parsed.data.date),
        amountBeforeTax: new Prisma.Decimal(parsed.data.amountBeforeTax),
        cgst: new Prisma.Decimal(parsed.data.cgst ?? 0),
        sgst: new Prisma.Decimal(parsed.data.sgst ?? 0),
        igst: new Prisma.Decimal(parsed.data.igst ?? 0),
        totalAmount: new Prisma.Decimal(parsed.data.amountBeforeTax)
          .add(new Prisma.Decimal(parsed.data.cgst ?? 0))
          .add(new Prisma.Decimal(parsed.data.sgst ?? 0))
          .add(new Prisma.Decimal(parsed.data.igst ?? 0)),
        paymentMode: parsed.data.paymentMode ?? null,
        paymentStatus: parsed.data.paymentStatus?.trim() || (parsed.data.paymentMode ? "PAID" : "UNPAID"),
        narration: parsed.data.narration?.trim() || null,
        expenseType: parsed.data.expenseType,
      },
      select: { id: true },
    });

    return { ok: true, data: updated };
  } catch {
    return unknownError("Failed to update expense.");
  }
}

export async function listExpenses(input: unknown): Promise<
  ActionResult<{
    items: Array<{
      id: string;
      date: string;
      totalAmount: string;
      paidAmount: string;
      balance: string;
      computedStatus: ReturnType<typeof calcExpenseStatus>;
      projectId: string;
      vendorId: string | null;
      labourerId: string | null;
      expenseType: string;
      narration: string | null;
    }>;
    total: number;
  }>
> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } };

  const parsed = expenseListSchema.safeParse(input ?? {});
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION", message: "Invalid input", fieldErrors: zodToFieldErrors(parsed.error) } };
  }

  const where = {
    tenantId: session.user.tenantId,
    ...(parsed.data.projectId ? { projectId: parsed.data.projectId } : {}),
    ...(parsed.data.vendorId ? { vendorId: parsed.data.vendorId } : {}),
    ...(parsed.data.labourerId ? { labourerId: parsed.data.labourerId } : {}),
    ...(parsed.data.expenseType ? { expenseType: parsed.data.expenseType as any } : {}),
  };

  try {
    const { items, total, allocSums } = await prisma.$transaction(async (tx) => {
      const list = await tx.expense.findMany({
        where,
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        take: parsed.data.take,
        skip: parsed.data.skip,
        select: {
          id: true,
          projectId: true,
          vendorId: true,
          labourerId: true,
          expenseType: true,
          date: true,
          totalAmount: true,
          narration: true,
        },
      });

      const ids = list.map((e) => e.id);
      const sums =
        ids.length === 0
          ? []
          : await tx.transactionAllocation.groupBy({
              by: ["documentId"],
              where: { tenantId: session.user.tenantId, documentType: "EXPENSE", documentId: { in: ids } },
              orderBy: { documentId: "asc" },
              _sum: { cashAmount: true, tdsAmount: true },
            });

      const count = await tx.expense.count({ where });

      return { items: list, total: count, allocSums: sums };
    });

    const byExpenseId = new Map<string, { cash: Prisma.Decimal; tds: Prisma.Decimal }>();
    for (const a of allocSums) {
      byExpenseId.set(a.documentId, {
        cash: a._sum?.cashAmount ?? new Prisma.Decimal(0),
        tds: a._sum?.tdsAmount ?? new Prisma.Decimal(0),
      });
    }

    const today = new Date();
    const mapped = items.map((exp) => {
      const sums = byExpenseId.get(exp.id) ?? { cash: new Prisma.Decimal(0), tds: new Prisma.Decimal(0) };
      const expenseLike = { total: exp.totalAmount };
      const paidAmount = calcExpensePaidAmount(expenseLike, [{ cashAmount: sums.cash, tdsAmount: sums.tds }]);
      const balance = calcExpenseBalance(expenseLike, [{ cashAmount: sums.cash, tdsAmount: sums.tds }]);
      const computedStatus = calcExpenseStatus(expenseLike, [{ cashAmount: sums.cash, tdsAmount: sums.tds }], today);

      return {
        id: exp.id,
        date: exp.date.toISOString().slice(0, 10),
        totalAmount: exp.totalAmount.toString(),
        paidAmount: paidAmount.toString(),
        balance: balance.toString(),
        computedStatus,
        projectId: exp.projectId,
        vendorId: exp.vendorId,
        labourerId: exp.labourerId,
        expenseType: String(exp.expenseType),
        narration: exp.narration,
      };
    });

    return { ok: true, data: { items: mapped, total } };
  } catch {
    return unknownError("Failed to load expenses.");
  }
}

