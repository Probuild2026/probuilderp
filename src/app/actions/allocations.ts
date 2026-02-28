"use server";

import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { z } from "zod";

import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

import { type ActionError, type ActionResult, unknownError, zodToFieldErrors } from "./_result";

const allocationItemSchema = z
  .object({
    invoiceId: z.string().min(1).optional(),
    expenseId: z.string().min(1).optional(),
    cashAmount: z.coerce.number().nonnegative(),
    tdsAmount: z.coerce.number().nonnegative().optional(),
  })
  .superRefine((val, ctx) => {
    const hasInvoice = !!val.invoiceId;
    const hasExpense = !!val.expenseId;
    if (hasInvoice === hasExpense) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Exactly one of invoiceId or expenseId is required.", path: [] });
    }
    const cash = val.cashAmount ?? 0;
    const tds = val.tdsAmount ?? 0;
    if (cash <= 0 && tds <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Allocation amount must be greater than 0.", path: [] });
    }
  });

const allocationCreateSchema = z
  .object({
    transactionId: z.string().min(1),
    items: z.array(allocationItemSchema).min(1),
  })
  .strict();

const allocationUpdateSchema = z
  .object({
    id: z.string().min(1),
    cashAmount: z.coerce.number().nonnegative(),
    tdsAmount: z.coerce.number().nonnegative().optional(),
  })
  .strict()
  .superRefine((val, ctx) => {
    const cash = val.cashAmount ?? 0;
    const tds = val.tdsAmount ?? 0;
    if (cash <= 0 && tds <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Allocation amount must be greater than 0.", path: [] });
    }
  });

const allocationDeleteSchema = z.object({ id: z.string().min(1) }).strict();

async function validateDocsExist(tenantId: number, items: Array<{ invoiceId?: string; expenseId?: string }>) {
  const invoiceIds = new Set(items.map((a) => a.invoiceId).filter(Boolean) as string[]);
  const expenseIds = new Set(items.map((a) => a.expenseId).filter(Boolean) as string[]);

  const checks: Array<Promise<number>> = [];
  if (invoiceIds.size) checks.push(prisma.clientInvoice.count({ where: { tenantId, id: { in: [...invoiceIds] } } }));
  if (expenseIds.size) checks.push(prisma.expense.count({ where: { tenantId, id: { in: [...expenseIds] } } }));
  const results = await Promise.all(checks);

  let cursor = 0;
  if (invoiceIds.size) {
    const found = results[cursor++]!;
    if (found !== invoiceIds.size) return { ok: false as const, message: "One or more invoices were not found." };
  }
  if (expenseIds.size) {
    const found = results[cursor++]!;
    if (found !== expenseIds.size) return { ok: false as const, message: "One or more expenses were not found." };
  }

  return { ok: true as const };
}

function allocationDocument(item: { invoiceId?: string; expenseId?: string }) {
  if (item.invoiceId) return { documentType: "CLIENT_INVOICE" as const, documentId: item.invoiceId };
  return { documentType: "EXPENSE" as const, documentId: item.expenseId! };
}

function validateDocTypeForTxn(txnType: "INCOME" | "EXPENSE" | "TRANSFER", items: Array<{ invoiceId?: string; expenseId?: string }>) {
  const hasInvoice = items.some((i) => !!i.invoiceId);
  const hasExpense = items.some((i) => !!i.expenseId);
  if (txnType === "TRANSFER" && (hasInvoice || hasExpense)) return { ok: false as const, message: "TRANSFER transactions cannot have allocations." };
  if (txnType === "INCOME" && hasExpense) return { ok: false as const, message: "INCOME transactions can only allocate to invoices." };
  if (txnType === "EXPENSE" && hasInvoice) return { ok: false as const, message: "EXPENSE transactions can only allocate to expenses." };
  return { ok: true as const };
}

export async function createAllocations(input: unknown): Promise<ActionResult<{ created: number }>> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } };

  const parsed = allocationCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION", message: "Invalid input", fieldErrors: zodToFieldErrors(parsed.error) } };
  }

  try {
    type TxResult = { ok: true; created: number } | { ok: false; error: ActionError };
    const result: TxResult = await prisma.$transaction(async (tx): Promise<TxResult> => {
      const transaction = await tx.transaction.findFirst({
        where: { id: parsed.data.transactionId, tenantId: session.user.tenantId },
        select: { id: true, amount: true, type: true, projectId: true },
      });
      if (!transaction) return { ok: false, error: { code: "NOT_FOUND", message: "Transaction not found." } };

      const typeCheck = validateDocTypeForTxn(transaction.type, parsed.data.items);
      if (!typeCheck.ok) return { ok: false, error: { code: "VALIDATION", message: typeCheck.message } };

      const docCheck = await validateDocsExist(session.user.tenantId, parsed.data.items);
      if (!docCheck.ok) return { ok: false, error: { code: "VALIDATION", message: docCheck.message } };

      const existing = await tx.transactionAllocation.aggregate({
        where: { tenantId: session.user.tenantId, transactionId: transaction.id },
        _sum: { cashAmount: true },
      });
      const existingCash = existing._sum.cashAmount ?? new Prisma.Decimal(0);
      const incomingCash = parsed.data.items.reduce((acc, a) => acc.add(new Prisma.Decimal(a.cashAmount)), new Prisma.Decimal(0));
      if (existingCash.add(incomingCash).gt(transaction.amount)) {
        return { ok: false, error: { code: "VALIDATION", message: "Allocations cash total exceeds transaction amount." } };
      }

      const created = await tx.transactionAllocation.createMany({
        data: parsed.data.items.map((a) => {
          const doc = allocationDocument(a);
          const cash = new Prisma.Decimal(a.cashAmount);
          const tds = new Prisma.Decimal(a.tdsAmount ?? 0);
          return {
            tenantId: session.user.tenantId,
            transactionId: transaction.id,
            documentType: doc.documentType,
            documentId: doc.documentId,
            projectId: transaction.projectId,
            cashAmount: cash,
            tdsAmount: tds,
            grossAmount: cash.add(tds),
          };
        }),
      });

      return { ok: true, created: created.count };
    });

    if (!result.ok) return { ok: false, error: result.error };
    return { ok: true, data: { created: result.created } };
  } catch {
    return unknownError("Failed to create allocations.");
  }
}

export async function replaceTransactionAllocations(input: unknown): Promise<ActionResult<{ id: string; created: number }>> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } };

  const parsed = allocationCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION", message: "Invalid input", fieldErrors: zodToFieldErrors(parsed.error) } };
  }

  try {
    type TxResult = { ok: true; created: number } | { ok: false; error: ActionError };
    const result: TxResult = await prisma.$transaction(async (tx): Promise<TxResult> => {
      const transaction = await tx.transaction.findFirst({
        where: { id: parsed.data.transactionId, tenantId: session.user.tenantId },
        select: { id: true, amount: true, type: true, projectId: true },
      });
      if (!transaction) return { ok: false, error: { code: "NOT_FOUND", message: "Transaction not found." } };

      const typeCheck = validateDocTypeForTxn(transaction.type, parsed.data.items);
      if (!typeCheck.ok) return { ok: false, error: { code: "VALIDATION", message: typeCheck.message } };

      const docCheck = await validateDocsExist(session.user.tenantId, parsed.data.items);
      if (!docCheck.ok) return { ok: false, error: { code: "VALIDATION", message: docCheck.message } };

      const incomingCash = parsed.data.items.reduce((acc, a) => acc.add(new Prisma.Decimal(a.cashAmount)), new Prisma.Decimal(0));
      if (incomingCash.gt(transaction.amount)) {
        return { ok: false, error: { code: "VALIDATION", message: "Allocations cash total exceeds transaction amount." } };
      }

      await tx.transactionAllocation.deleteMany({ where: { tenantId: session.user.tenantId, transactionId: transaction.id } });
      const created = await tx.transactionAllocation.createMany({
        data: parsed.data.items.map((a) => {
          const doc = allocationDocument(a);
          const cash = new Prisma.Decimal(a.cashAmount);
          const tds = new Prisma.Decimal(a.tdsAmount ?? 0);
          return {
            tenantId: session.user.tenantId,
            transactionId: transaction.id,
            documentType: doc.documentType,
            documentId: doc.documentId,
            projectId: transaction.projectId,
            cashAmount: cash,
            tdsAmount: tds,
            grossAmount: cash.add(tds),
          };
        }),
      });

      return { ok: true, created: created.count };
    });

    if (!result.ok) return { ok: false, error: result.error };
    return { ok: true, data: { id: parsed.data.transactionId, created: result.created } };
  } catch {
    return unknownError("Failed to replace allocations.");
  }
}

export async function updateAllocation(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } };

  const parsed = allocationUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION", message: "Invalid input", fieldErrors: zodToFieldErrors(parsed.error) } };
  }

  try {
    type TxResult = { ok: true; id: string } | { ok: false; error: ActionError };
    const result: TxResult = await prisma.$transaction(async (tx): Promise<TxResult> => {
      const current = await tx.transactionAllocation.findFirst({
        where: { id: parsed.data.id, tenantId: session.user.tenantId },
        select: { id: true, transactionId: true },
      });
      if (!current) return { ok: false, error: { code: "NOT_FOUND", message: "Allocation not found." } };

      const transaction = await tx.transaction.findFirst({
        where: { id: current.transactionId, tenantId: session.user.tenantId },
        select: { id: true, amount: true },
      });
      if (!transaction) return { ok: false, error: { code: "NOT_FOUND", message: "Transaction not found." } };

      const sums = await tx.transactionAllocation.aggregate({
        where: { tenantId: session.user.tenantId, transactionId: current.transactionId, id: { not: current.id } },
        _sum: { cashAmount: true },
      });
      const otherCash = sums._sum.cashAmount ?? new Prisma.Decimal(0);
      const nextCash = otherCash.add(new Prisma.Decimal(parsed.data.cashAmount));
      if (nextCash.gt(transaction.amount)) {
        return { ok: false, error: { code: "VALIDATION", message: "Allocations cash total exceeds transaction amount." } };
      }

      const cash = new Prisma.Decimal(parsed.data.cashAmount);
      const tds = new Prisma.Decimal(parsed.data.tdsAmount ?? 0);

      const updated = await tx.transactionAllocation.update({
        where: { id: current.id, tenantId: session.user.tenantId },
        data: { cashAmount: cash, tdsAmount: tds, grossAmount: cash.add(tds) },
        select: { id: true },
      });

      return { ok: true, id: updated.id };
    });

    if (!result.ok) return { ok: false, error: result.error };
    return { ok: true, data: { id: result.id } };
  } catch {
    return unknownError("Failed to update allocation.");
  }
}

export async function deleteAllocation(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } };

  const parsed = allocationDeleteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION", message: "Invalid input", fieldErrors: zodToFieldErrors(parsed.error) } };
  }

  try {
    await prisma.transactionAllocation.delete({
      where: { id: parsed.data.id, tenantId: session.user.tenantId },
      select: { id: true },
    });

    return { ok: true, data: { id: parsed.data.id } };
  } catch {
    return unknownError("Failed to delete allocation.");
  }
}

