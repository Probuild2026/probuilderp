"use server";

import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { z } from "zod";

import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

import { type ActionResult, unknownError, zodToFieldErrors } from "./_result";

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

const transactionBaseSchema = z
  .object({
    type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
    date: z.string().min(1),
    amount: z.coerce.number().positive(),
    projectId: z.string().optional(),
    categoryId: z.string().optional(),
    fromAccountId: z.string().optional(),
    toAccountId: z.string().optional(),
    note: z.string().max(2000).optional(),
    description: z.string().max(5000).optional(),
  })
  .superRefine((val, ctx) => {
    const categoryId = val.categoryId?.trim();
    const fromAccountId = val.fromAccountId?.trim();
    const toAccountId = val.toAccountId?.trim();

    if ((val.type === "INCOME" || val.type === "EXPENSE") && !categoryId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Category is required.", path: ["categoryId"] });
    }
    if (val.type === "INCOME" && !toAccountId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "toAccountId is required for INCOME.", path: ["toAccountId"] });
    }
    if (val.type === "EXPENSE" && !fromAccountId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "fromAccountId is required for EXPENSE.", path: ["fromAccountId"] });
    }
    if (val.type === "TRANSFER") {
      if (!fromAccountId || !toAccountId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "From/To accounts are required.", path: [] });
      } else if (fromAccountId === toAccountId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "From and To accounts must be different.", path: [] });
      }
    }
  });

const transactionCreateSchema = transactionBaseSchema.extend({
  allocations: z.array(allocationItemSchema).optional(),
});

const transactionUpdateSchema = transactionBaseSchema.extend({
  id: z.string().min(1),
});

const transactionListSchema = z.object({
  type: z.string().optional(),
  projectId: z.string().optional(),
  categoryId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
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

function allocationDocument(item: { invoiceId?: string; expenseId?: string }) {
  if (item.invoiceId) return { documentType: "CLIENT_INVOICE" as const, documentId: item.invoiceId };
  return { documentType: "EXPENSE" as const, documentId: item.expenseId! };
}

async function validateAllocationDocuments(tenantId: number, type: "INCOME" | "EXPENSE" | "TRANSFER", allocations: Array<{ invoiceId?: string; expenseId?: string }>) {
  const invoiceIds = new Set(allocations.map((a) => a.invoiceId).filter(Boolean) as string[]);
  const expenseIds = new Set(allocations.map((a) => a.expenseId).filter(Boolean) as string[]);

  if (type === "TRANSFER" && (invoiceIds.size > 0 || expenseIds.size > 0)) {
    return { ok: false as const, message: "TRANSFER transactions cannot have allocations." };
  }
  if (type === "INCOME" && expenseIds.size > 0) return { ok: false as const, message: "INCOME transactions can only allocate to invoices." };
  if (type === "EXPENSE" && invoiceIds.size > 0) return { ok: false as const, message: "EXPENSE transactions can only allocate to expenses." };

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

export async function createTransaction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } };

  const parsed = transactionCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION", message: "Invalid input", fieldErrors: zodToFieldErrors(parsed.error) } };
  }

  const allocations = parsed.data.allocations ?? [];
  try {
    const docValidation = await validateAllocationDocuments(session.user.tenantId, parsed.data.type, allocations);
    if (!docValidation.ok) return { ok: false, error: { code: "VALIDATION", message: docValidation.message } };

    const amount = new Prisma.Decimal(parsed.data.amount);
    const sumCash = allocations.reduce((acc, a) => acc.add(new Prisma.Decimal(a.cashAmount)), new Prisma.Decimal(0));
    if (sumCash.gt(amount)) return { ok: false, error: { code: "VALIDATION", message: "Allocations cash total exceeds transaction amount." } };

    const created = await prisma.$transaction(async (tx) => {
      const txn = await tx.transaction.create({
        data: {
          tenantId: session.user.tenantId,
          type: parsed.data.type,
          date: parseDateOnly(parsed.data.date),
          amount,
          projectId: parsed.data.projectId?.trim() || null,
          categoryId: parsed.data.categoryId?.trim() || null,
          fromAccountId: parsed.data.type === "INCOME" ? null : parsed.data.fromAccountId?.trim() || null,
          toAccountId: parsed.data.type === "EXPENSE" ? null : parsed.data.toAccountId?.trim() || null,
          note: parsed.data.note?.trim() || null,
          description: parsed.data.description?.trim() || null,
        },
        select: { id: true, projectId: true },
      });

      if (allocations.length) {
        await tx.transactionAllocation.createMany({
          data: allocations.map((a) => {
            const doc = allocationDocument(a);
            const cash = new Prisma.Decimal(a.cashAmount);
            const tds = new Prisma.Decimal(a.tdsAmount ?? 0);
            return {
              tenantId: session.user.tenantId,
              transactionId: txn.id,
              documentType: doc.documentType,
              documentId: doc.documentId,
              projectId: txn.projectId,
              cashAmount: cash,
              tdsAmount: tds,
              grossAmount: cash.add(tds),
            };
          }),
        });
      }

      return txn;
    });

    return { ok: true, data: { id: created.id } };
  } catch {
    return unknownError("Failed to create transaction.");
  }
}

export async function updateTransaction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } };

  const parsed = transactionUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION", message: "Invalid input", fieldErrors: zodToFieldErrors(parsed.error) } };
  }

  try {
    const updated = await prisma.transaction.update({
      where: { id: parsed.data.id, tenantId: session.user.tenantId },
      data: {
        type: parsed.data.type,
        date: parseDateOnly(parsed.data.date),
        amount: new Prisma.Decimal(parsed.data.amount),
        projectId: parsed.data.projectId?.trim() || null,
        categoryId: parsed.data.categoryId?.trim() || null,
        fromAccountId: parsed.data.type === "INCOME" ? null : parsed.data.fromAccountId?.trim() || null,
        toAccountId: parsed.data.type === "EXPENSE" ? null : parsed.data.toAccountId?.trim() || null,
        note: parsed.data.note?.trim() || null,
        description: parsed.data.description?.trim() || null,
      },
      select: { id: true },
    });

    return { ok: true, data: updated };
  } catch {
    return unknownError("Failed to update transaction.");
  }
}

export async function listTransactions(input: unknown): Promise<
  ActionResult<{
    items: Array<{
      id: string;
      type: string;
      date: string;
      amount: string;
      projectId: string | null;
      categoryId: string | null;
      fromAccountId: string | null;
      toAccountId: string | null;
      note: string | null;
      description: string | null;
    }>;
    total: number;
  }>
> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } };

  const parsed = transactionListSchema.safeParse(input ?? {});
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION", message: "Invalid input", fieldErrors: zodToFieldErrors(parsed.error) } };
  }

  const where = {
    tenantId: session.user.tenantId,
    ...(parsed.data.type ? { type: parsed.data.type as any } : {}),
    ...(parsed.data.projectId ? { projectId: parsed.data.projectId } : {}),
    ...(parsed.data.categoryId ? { categoryId: parsed.data.categoryId } : {}),
    ...(parsed.data.dateFrom || parsed.data.dateTo
      ? {
          date: {
            ...(parsed.data.dateFrom ? { gte: optionalDate(parsed.data.dateFrom) as any } : {}),
            ...(parsed.data.dateTo ? { lte: optionalDate(parsed.data.dateTo) as any } : {}),
          },
        }
      : {}),
  };

  try {
    const [items, total] = await prisma.$transaction([
      prisma.transaction.findMany({
        where,
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        take: parsed.data.take,
        skip: parsed.data.skip,
        select: {
          id: true,
          type: true,
          date: true,
          amount: true,
          projectId: true,
          categoryId: true,
          fromAccountId: true,
          toAccountId: true,
          note: true,
          description: true,
        },
      }),
      prisma.transaction.count({ where }),
    ]);

    return {
      ok: true,
      data: {
        total,
        items: items.map((t) => ({
          id: t.id,
          type: t.type,
          date: t.date.toISOString().slice(0, 10),
          amount: t.amount.toString(),
          projectId: t.projectId,
          categoryId: t.categoryId,
          fromAccountId: t.fromAccountId,
          toAccountId: t.toAccountId,
          note: t.note,
          description: t.description,
        })),
      },
    };
  } catch {
    return unknownError("Failed to load transactions.");
  }
}

