"use server";

import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { z } from "zod";

import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

import { type ActionError, type ActionResult, unknownError, zodToFieldErrors } from "./_result";

const receiptCreateSchema = z
  .object({
    date: z.string().min(1),
    mode: z.enum(["CASH", "BANK_TRANSFER", "CHEQUE", "UPI", "CARD", "OTHER"]),
    reference: z.string().max(200).optional(),
    amount: z.coerce.number().positive(),
    tdsAmount: z.coerce.number().nonnegative().optional(),
    clientId: z.string().min(1),
    projectId: z.string().optional(),
    allocations: z
      .array(
        z.object({
          invoiceId: z.string().min(1),
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

export async function createReceipt(input: unknown): Promise<
  ActionResult<{
    transaction: {
      id: string;
      date: string;
      amount: string;
      tdsAmount: string;
      mode: string | null;
      reference: string | null;
      clientId: string | null;
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

  const parsed = receiptCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION", message: "Invalid input", fieldErrors: zodToFieldErrors(parsed.error) } };
  }

  const cash = new Prisma.Decimal(parsed.data.amount);
  const tds = new Prisma.Decimal(parsed.data.tdsAmount ?? 0);
  const grossAvailable = cash.add(tds);
  const grossApplied = parsed.data.allocations.reduce((acc, a) => acc.add(new Prisma.Decimal(a.amountApplied)), new Prisma.Decimal(0));

  if (grossApplied.gt(grossAvailable)) {
    return { ok: false, error: { code: "VALIDATION", message: "Sum of allocations exceeds (amount + tdsAmount)." } };
  }

  try {
    type TxResult =
      | {
          ok: true;
          transaction: {
            id: string;
            date: Date;
            amount: Prisma.Decimal;
            tdsAmount: Prisma.Decimal;
            mode: string | null;
            reference: string | null;
            clientId: string | null;
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
      const invoiceIds = [...new Set(parsed.data.allocations.map((a) => a.invoiceId))];
      const invoices = await tx.clientInvoice.findMany({
        where: { tenantId: session.user.tenantId, id: { in: invoiceIds } },
        select: { id: true, clientId: true, projectId: true, invoiceNumber: true },
      });
      if (invoices.length !== invoiceIds.length) {
        return { ok: false, error: { code: "VALIDATION", message: "One or more invoices were not found." } };
      }
      if (invoices.some((inv) => inv.clientId !== parsed.data.clientId)) {
        return { ok: false, error: { code: "VALIDATION", message: "One or more invoices do not belong to this client." } };
      }
      if (parsed.data.projectId && invoices.some((inv) => inv.projectId !== parsed.data.projectId)) {
        return { ok: false, error: { code: "VALIDATION", message: "One or more invoices do not belong to this project." } };
      }

      const transaction = await tx.transaction.create({
        data: {
          tenantId: session.user.tenantId,
          type: "INCOME",
          date: parseDateOnly(parsed.data.date),
          amount: cash,
          tdsAmount: tds,
          mode: parsed.data.mode,
          reference: parsed.data.reference?.trim() || null,
          projectId: parsed.data.projectId?.trim() || null,
          clientId: parsed.data.clientId,
          note: parsed.data.note?.trim() || null,
          description: parsed.data.description?.trim() || null,
        },
        select: { id: true, date: true, amount: true, tdsAmount: true, mode: true, reference: true, clientId: true, projectId: true },
      });

      // Distribute TDS sequentially across allocations (simple + deterministic).
      let remainingTds = tds;
      let remainingCash = cash;

      const rows = parsed.data.allocations.map((a) => {
        const gross = new Prisma.Decimal(a.amountApplied);
        const tdsPart = Prisma.Decimal.min(remainingTds, gross);
        const cashPart = gross.sub(tdsPart);
        remainingTds = remainingTds.sub(tdsPart);
        remainingCash = remainingCash.sub(cashPart);
        return { invoiceId: a.invoiceId, cashAmount: cashPart, tdsAmount: tdsPart, grossAmount: gross };
      });

      if (remainingCash.lt(0)) {
        return { ok: false, error: { code: "VALIDATION", message: "Allocations require more cash than amount." } };
      }

      await tx.transactionAllocation.createMany({
        data: rows.map((r) => ({
          tenantId: session.user.tenantId,
          transactionId: transaction.id,
          documentType: "CLIENT_INVOICE",
          documentId: r.invoiceId,
          projectId: transaction.projectId,
          cashAmount: r.cashAmount,
          tdsAmount: r.tdsAmount,
          grossAmount: r.grossAmount,
        })),
      });

      const allocations = await tx.transactionAllocation.findMany({
        where: { tenantId: session.user.tenantId, transactionId: transaction.id, documentType: "CLIENT_INVOICE" },
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
          tdsAmount: result.transaction.tdsAmount.toString(),
          mode: result.transaction.mode,
          reference: result.transaction.reference,
          clientId: result.transaction.clientId,
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
    return unknownError("Failed to create receipt.");
  }
}
