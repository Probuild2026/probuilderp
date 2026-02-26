"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth/next";

import {
  financeAccountCreateSchema,
  transactionCreateSchema,
  txnCategoryCreateSchema,
} from "@/lib/validators/transaction";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";
import { saveUploadToDisk } from "@/server/storage";

function parseDateOnly(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid date");
  return date;
}

function normalizeOptionalId(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export async function createTransaction(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const raw = Object.fromEntries(formData.entries());
  const parsed = transactionCreateSchema.parse(raw);

  const type = parsed.type;
  const categoryId = normalizeOptionalId(parsed.categoryId);
  const fromAccountId = normalizeOptionalId(parsed.fromAccountId);
  const toAccountId = normalizeOptionalId(parsed.toAccountId);

  if ((type === "INCOME" || type === "EXPENSE") && !categoryId) {
    throw new Error("Category is required.");
  }
  if (type === "INCOME" && !toAccountId) throw new Error("Account is required.");
  if (type === "EXPENSE" && !fromAccountId) throw new Error("Account is required.");
  if (type === "TRANSFER") {
    if (!fromAccountId || !toAccountId) throw new Error("From/To accounts are required.");
    if (fromAccountId === toAccountId) throw new Error("From and To accounts must be different.");
  }

  const tx = await prisma.transaction.create({
    data: {
      tenantId: session.user.tenantId,
      type,
      date: parseDateOnly(parsed.date),
      amount: parsed.amount,
      projectId: normalizeOptionalId(parsed.projectId),
      categoryId,
      fromAccountId: type === "INCOME" ? null : fromAccountId,
      toAccountId: type === "EXPENSE" ? null : toAccountId,
      note: parsed.note?.trim() ? parsed.note.trim() : null,
      description: parsed.description?.trim() ? parsed.description.trim() : null,
    },
  });

  const file = formData.get("attachment");
  if (file instanceof File && file.size > 0) {
    const saved = await saveUploadToDisk({
      tenantId: session.user.tenantId,
      entityPath: `transactions/${tx.id}`,
      file,
    });

    await prisma.attachment.create({
      data: {
        tenantId: session.user.tenantId,
        entityType: "TRANSACTION",
        entityId: tx.id,
        projectId: tx.projectId,
        originalName: saved.originalName,
        mimeType: saved.mimeType,
        size: saved.size,
        storagePath: saved.storagePath,
        uploadedById: session.user.id,
      },
    });
  }

  revalidatePath("/app/transactions");
}

export async function createFinanceAccount(input: unknown) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const parsed = financeAccountCreateSchema.parse(input);

  await prisma.financeAccount.create({
    data: {
      tenantId: session.user.tenantId,
      name: parsed.name.trim(),
      type: parsed.type,
    },
  });

  revalidatePath("/app/transactions/new");
}

export async function createTxnCategory(input: unknown) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const parsed = txnCategoryCreateSchema.parse(input);

  await prisma.txnCategory.create({
    data: {
      tenantId: session.user.tenantId,
      name: parsed.name.trim(),
      type: parsed.type,
    },
  });

  revalidatePath("/app/transactions/new");
}

