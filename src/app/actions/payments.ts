"use server";

import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { z } from "zod";

import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";
import { calculateTDS194C, determineTDS194CRatePct } from "@/lib/tds";

import { type ActionError, type ActionResult, unknownError, zodToFieldErrors } from "./_result";

const payExpensesSchema = z
  .object({
    date: z.string().min(1),
    mode: z.enum(["CASH", "BANK_TRANSFER", "CHEQUE", "UPI", "CARD", "OTHER"]),
    reference: z.string().max(200).optional(),
    amount: z.coerce.number().positive(),
    vendorId: z.string().min(1),
    projectId: z.string().optional(),
    hasTransporterDeclaration: z.coerce.boolean().optional(),
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

function fyStartForIndia(date: Date) {
  // India FY: Apr 1 → Mar 31
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-11
  const startYear = month >= 3 ? year : year - 1;
  return new Date(startYear, 3, 1, 0, 0, 0, 0);
}

export async function payExpenses(input: unknown): Promise<
  ActionResult<{
    transaction: {
      id: string;
      date: string;
      amount: string;
      tdsAmount: string;
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
            tdsAmount: Prisma.Decimal;
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
        select: { id: true, vendorId: true, projectId: true, amountBeforeTax: true, totalAmount: true },
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

      const vendor = await tx.vendor.findUnique({
        where: { tenantId: session.user.tenantId, id: parsed.data.vendorId },
        select: {
          id: true,
          isSubcontractor: true,
          legalType: true,
          pan: true,
          isTransporter: true,
          transporterVehicleCount: true,
          tdsOverrideRate: true,
          tdsThresholdSingle: true,
          tdsThresholdAnnual: true,
        },
      });
      if (!vendor) return { ok: false, error: { code: "VALIDATION", message: "Vendor not found." } };

      const payDate = parseDateOnly(parsed.data.date);
      const fyStart = fyStartForIndia(payDate);

      const expenseById = new Map(
        expenses.map((e) => [
          e.id,
          {
            amountBeforeTax: e.amountBeforeTax,
            totalAmount: e.totalAmount,
          },
        ]),
      );

      const currentAllocCash = parsed.data.allocations.map((a) => ({
        expenseId: a.expenseId,
        cashAmount: new Prisma.Decimal(a.amountApplied),
      }));

      const hasTransporterDeclaration = parsed.data.hasTransporterDeclaration ?? false;

      // TDS is currently auto-calculated for subcontractor payments (194C defaults).
      const ratePct = vendor.isSubcontractor
        ? determineTDS194CRatePct({
            vendor: {
              legalType: vendor.legalType,
              pan: vendor.pan,
              isTransporter: vendor.isTransporter,
              transporterVehicleCount: vendor.transporterVehicleCount,
              tdsOverrideRate: vendor.tdsOverrideRate,
              tdsThresholdSingle: vendor.tdsThresholdSingle,
              tdsThresholdAnnual: vendor.tdsThresholdAnnual,
            },
            hasTransporterDeclaration,
          })
        : 0;

      const priorAllocs = vendor.isSubcontractor
        ? await tx.transactionAllocation.findMany({
            where: {
              tenantId: session.user.tenantId,
              documentType: "EXPENSE",
              transaction: {
                vendorId: parsed.data.vendorId,
                type: "EXPENSE",
                date: { gte: fyStart, lt: payDate },
              },
            },
            select: { documentId: true, grossAmount: true },
          })
        : [];

      const priorExpenseIds = [...new Set(priorAllocs.map((a) => a.documentId))];
      const priorExpenses = priorExpenseIds.length
        ? await tx.expense.findMany({
            where: { tenantId: session.user.tenantId, id: { in: priorExpenseIds } },
            select: { id: true, amountBeforeTax: true, totalAmount: true },
          })
        : [];
      const priorExpenseById = new Map(priorExpenses.map((e) => [e.id, e]));

      const ytdTaxableBase = priorAllocs.reduce((acc, a) => {
        const exp = priorExpenseById.get(a.documentId);
        if (!exp) return acc;
        if (exp.totalAmount.lte(0)) return acc.add(a.grossAmount);
        const ratio = exp.amountBeforeTax.div(exp.totalAmount);
        return acc.add(a.grossAmount.mul(ratio));
      }, new Prisma.Decimal(0));

      const currentBaseNoTds = currentAllocCash.reduce((acc, a) => {
        const exp = expenseById.get(a.expenseId);
        if (!exp) return acc;
        if (exp.totalAmount.lte(0)) return acc.add(a.cashAmount);
        const ratio = exp.amountBeforeTax.div(exp.totalAmount);
        return acc.add(a.cashAmount.mul(ratio));
      }, new Prisma.Decimal(0));

      const baseAssumingTds = ratePct > 0
        ? currentAllocCash.reduce((acc, a) => {
            const exp = expenseById.get(a.expenseId);
            if (!exp) return acc;
            if (exp.totalAmount.lte(0)) return acc.add(a.cashAmount);
            const ratio = exp.amountBeforeTax.div(exp.totalAmount);
            const x = ratio.mul(ratePct).div(100);
            const denom = new Prisma.Decimal(1).sub(x);
            if (denom.lte(0)) return acc.add(a.cashAmount.mul(ratio));
            return acc.add(a.cashAmount.mul(ratio).div(denom));
      }, new Prisma.Decimal(0))
        : currentBaseNoTds;

      // Determine applicability; if thresholds are breached only when assuming TDS, use that base.
      let tdsCalc = vendor.isSubcontractor && ratePct > 0
        ? calculateTDS194C({
            vendor: {
              legalType: vendor.legalType,
              pan: vendor.pan,
              isTransporter: vendor.isTransporter,
              transporterVehicleCount: vendor.transporterVehicleCount,
              tdsOverrideRate: vendor.tdsOverrideRate,
              tdsThresholdSingle: vendor.tdsThresholdSingle,
              tdsThresholdAnnual: vendor.tdsThresholdAnnual,
            },
            currentAmount: currentBaseNoTds,
            ytdAmount: ytdTaxableBase,
            hasTransporterDeclaration,
          })
        : { applicable: false, ratePct: 0, tdsAmount: new Prisma.Decimal(0), thresholdBreached: "NONE" as const, reason: "" };

      if (!tdsCalc.applicable && vendor.isSubcontractor && ratePct > 0) {
        const tdsCalcAlt = calculateTDS194C({
          vendor: {
            legalType: vendor.legalType,
            pan: vendor.pan,
            isTransporter: vendor.isTransporter,
            transporterVehicleCount: vendor.transporterVehicleCount,
            tdsOverrideRate: vendor.tdsOverrideRate,
            tdsThresholdSingle: vendor.tdsThresholdSingle,
            tdsThresholdAnnual: vendor.tdsThresholdAnnual,
          },
          currentAmount: baseAssumingTds,
          ytdAmount: ytdTaxableBase,
          hasTransporterDeclaration,
        });
        if (tdsCalcAlt.applicable) {
          tdsCalc = tdsCalcAlt;
        }
      }

      const totalTds = tdsCalc.applicable ? tdsCalc.tdsAmount : new Prisma.Decimal(0);

      const transaction = await tx.transaction.create({
        data: {
          tenantId: session.user.tenantId,
          type: "EXPENSE",
          date: payDate,
          amount: cash,
          tdsAmount: totalTds,
          mode: parsed.data.mode,
          reference: parsed.data.reference?.trim() || null,
          projectId: parsed.data.projectId?.trim() || null,
          vendorId: parsed.data.vendorId,
          note: parsed.data.note?.trim() || null,
          description: parsed.data.description?.trim() || null,
        },
        select: { id: true, date: true, amount: true, tdsAmount: true, mode: true, reference: true, vendorId: true, projectId: true },
      });

      const allocationRows = (() => {
        if (!tdsCalc.applicable || ratePct <= 0) {
          return parsed.data.allocations.map((a) => {
            const cashAmount = new Prisma.Decimal(a.amountApplied);
            return {
              tenantId: session.user.tenantId,
              transactionId: transaction.id,
              documentType: "EXPENSE" as const,
              documentId: a.expenseId,
              projectId: transaction.projectId,
              cashAmount,
              tdsAmount: new Prisma.Decimal(0),
              grossAmount: cashAmount,
            };
          });
        }

        const r = new Prisma.Decimal(ratePct).div(100);

        const unrounded = parsed.data.allocations.map((a) => {
          const cashAmount = new Prisma.Decimal(a.amountApplied);
          const exp = expenseById.get(a.expenseId);
          if (!exp || exp.totalAmount.lte(0)) {
            return { expenseId: a.expenseId, cashAmount, tdsAmount: new Prisma.Decimal(0) };
          }
          const ratio = exp.amountBeforeTax.div(exp.totalAmount);
          const x = ratio.mul(r);
          const denom = new Prisma.Decimal(1).sub(x);
          if (denom.lte(0)) return { expenseId: a.expenseId, cashAmount, tdsAmount: new Prisma.Decimal(0) };
          const tdsAmount = cashAmount.mul(x).div(denom);
          return { expenseId: a.expenseId, cashAmount, tdsAmount };
        });

        const rounded = unrounded.map((a) => ({ ...a, tdsAmount: a.tdsAmount.toDecimalPlaces(2) }));
        const roundedSum = rounded.reduce((acc, a) => acc.add(a.tdsAmount), new Prisma.Decimal(0));
        let diff = totalTds.sub(roundedSum);
        diff = diff.abs().lte(0.01) ? diff : diff; // keep as-is; we'll apply to last row

        if (rounded.length > 0 && !diff.isZero()) {
          const last = rounded[rounded.length - 1]!;
          last.tdsAmount = last.tdsAmount.add(diff).toDecimalPlaces(2);
        }

        return rounded.map((a) => {
          const grossAmount = a.cashAmount.add(a.tdsAmount);
          return {
            tenantId: session.user.tenantId,
            transactionId: transaction.id,
            documentType: "EXPENSE" as const,
            documentId: a.expenseId,
            projectId: transaction.projectId,
            cashAmount: a.cashAmount,
            tdsAmount: a.tdsAmount,
            grossAmount,
          };
        });
      })();

      await tx.transactionAllocation.createMany({ data: allocationRows });

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
          tdsAmount: result.transaction.tdsAmount.toString(),
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
