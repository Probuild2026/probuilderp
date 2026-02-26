import { z } from "zod";

export const transactionCreateSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
  date: z.string().min(1),
  amount: z.coerce.number().positive(),
  projectId: z.string().optional(),
  categoryId: z.string().optional(),
  fromAccountId: z.string().optional(),
  toAccountId: z.string().optional(),
  note: z.string().optional(),
  description: z.string().optional(),
});

export const financeAccountCreateSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(["CASH", "BANK", "UPI", "CARD", "OTHER"]),
});

export const txnCategoryCreateSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
});

