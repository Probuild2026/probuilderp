"use server";

import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { z } from "zod";

import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

import { type ActionError, type ActionResult, unknownError, zodToFieldErrors } from "./_result";

const payExpensesSchema = z
  .object({
    date: z.string().min(1),
    mode: z.enum(["CASH", "BANK_TRANSFER", "CHEQUE", "UPI", "CARD", "OTHER"]),
    reference: z.string().max(200).optional(),
    amount: z.coerce.number().positive(),
    vendorId: z.string().min(1),
    projectId: z.string().optional(),
    allocations: z
      .array(
        z.object({
          expenseId: z.string().min(1),
          amountApplied: z.coerce.number().positive(),
        }),
      )
      .min(1),
    note: z.string().max(2000).optional(),
    description: z.string().max(5000).optional(),
  })
  .strict();

function parseDateOnly(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid date");
  return date;
}

export async function payExpenses(input: unknown): Promise<
  ActionResult<{
    transaction: {
      id: string;
      date: string;
      amount: string;
      mode: string | null;
      reference: string | null;
      vendorId: string | null;
      projectId: string | null;
    };
    allocations: Array<{
      id: string;
      documentId: string;
      cashAmount: string;
      tdsAmount: string;
      grossAmount: string;
    }>;
  }>
> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } };

  const parsed = payExpensesSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION", message: "Invalid input", fieldErrors: zodToFieldErrors(parsed.error) } };
  }

  const cash = new Prisma.Decimal(parsed.data.amount);
  const cashApplied = parsed.data.allocations.reduce((acc, a) => acc.add(new Prisma.Decimal(a.amountApplied)), new Prisma.Decimal(0));
  if (cashApplied.gt(cash)) {
    return { ok: false, error: { code: "VALIDATION", message: "Sum of allocations exceeds amount." } };
  }

  try {
    type TxResult =
      | {
          ok: true;
          transaction: {
            id: string;
            date: Date;
            amount: Prisma.Decimal;
            mode: string | null;
            reference: string | null;
            vendorId: string | null;
            projectId: string | null;
          };
          allocations: Array<{
            id: string;
            documentId: string;
            cashAmount: Prisma.Decimal;
            tdsAmount: Prisma.Decimal;
            grossAmount: Prisma.Decimal;
          }>;
        }
      | { ok: false; error: ActionError };

    const result: TxResult = await prisma.$transaction(async (tx): Promise<TxResult> => {
      const expenseIds = [...new Set(parsed.data.allocations.map((a) => a.expenseId))];
      const expenses = await tx.expense.findMany({
        where: { tenantId: session.user.tenantId, id: { in: expenseIds } },
        select: { id: true, vendorId: true, projectId: true },
      });
      if (expenses.length !== expenseIds.length) {
        return { ok: false, error: { code: "VALIDATION", message: "One or more expenses were not found." } };
      }
      if (expenses.some((e) => e.vendorId !== parsed.data.vendorId)) {
        return { ok: false, error: { code: "VALIDATION", message: "One or more expenses do not belong to this vendor." } };
      }
      if (parsed.data.projectId && expenses.some((e) => e.projectId !== parsed.data.projectId)) {
        return { ok: false, error: { code: "VALIDATION", message: "One or more expenses do not belong to this project." } };
      }

      const transaction = await tx.transaction.create({
        data: {
          tenantId: session.user.tenantId,
          type: "EXPENSE",
          date: parseDateOnly(parsed.data.date),
          amount: cash,
          tdsAmount: new Prisma.Decimal(0),
          mode: parsed.data.mode,
          reference: parsed.data.reference?.trim() || null,
          projectId: parsed.data.projectId?.trim() || null,
          vendorId: parsed.data.vendorId,
          note: parsed.data.note?.trim() || null,
          description: parsed.data.description?.trim() || null,
        },
        select: { id: true, date: true, amount: true, mode: true, reference: true, vendorId: true, projectId: true },
      });

      await tx.transactionAllocation.createMany({
        data: parsed.data.allocations.map((a) => {
          const cashAmount = new Prisma.Decimal(a.amountApplied);
          return {
            tenantId: session.user.tenantId,
            transactionId: transaction.id,
            documentType: "EXPENSE",
            documentId: a.expenseId,
            projectId: transaction.projectId,
            cashAmount,
            tdsAmount: new Prisma.Decimal(0),
            grossAmount: cashAmount,
          };
        }),
      });

      const allocations = await tx.transactionAllocation.findMany({
        where: { tenantId: session.user.tenantId, transactionId: transaction.id, documentType: "EXPENSE" },
        select: { id: true, documentId: true, cashAmount: true, tdsAmount: true, grossAmount: true },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });

      return { ok: true, transaction, allocations };
    });

    if (!result.ok) return { ok: false, error: result.error };

    return {
      ok: true,
      data: {
        transaction: {
          id: result.transaction.id,
          date: result.transaction.date.toISOString().slice(0, 10),
          amount: result.transaction.amount.toString(),
          mode: result.transaction.mode,
          reference: result.transaction.reference,
          vendorId: result.transaction.vendorId,
          projectId: result.transaction.projectId,
        },
        allocations: result.allocations.map((a) => ({
          id: a.id,
          documentId: a.documentId,
          cashAmount: a.cashAmount.toString(),
          tdsAmount: a.tdsAmount.toString(),
          grossAmount: a.grossAmount.toString(),
        })),
      },
    };
  } catch {
    return unknownError("Failed to pay expenses.");
  }
}
