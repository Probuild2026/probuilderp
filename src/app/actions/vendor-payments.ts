"use server";

import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { z } from "zod";

import { calculateTDS194C, determineTDS194CRatePct } from "@/lib/tds";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

import { type ActionError, type ActionResult, unknownError, zodToFieldErrors } from "./_result";
import { revalidatePath } from "next/cache";

const allocationSchema = z
  .object({
    purchaseInvoiceId: z.string().min(1),
    grossAmount: z.coerce.number().positive(),
  })
  .strict();

const createVendorPaymentSchema = z
  .object({
    date: z.string().min(1),
    mode: z.enum(["CASH", "BANK_TRANSFER", "CHEQUE", "UPI", "CARD", "OTHER"]),
    reference: z.string().max(200).optional(),
    vendorId: z.string().min(1),
    projectId: z.string().optional(),
    // If allocations are empty, this grossAmount is used (lump-sum subcontractor payment).
    grossAmount: z.coerce.number().positive().optional(),
    allocations: z.array(allocationSchema).optional(),
    hasTransporterDeclaration: z.coerce.boolean().optional(),
    note: z.string().max(2000).optional(),
    description: z.string().max(5000).optional(),
  })
  .strict()
  .superRefine((val, ctx) => {
    const hasAllocs = (val.allocations?.length ?? 0) > 0;
    if (!hasAllocs && !val.grossAmount) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["grossAmount"], message: "Gross amount is required when no bills are selected." });
    }
  });

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

const updateVendorPaymentMetaSchema = z
  .object({
    id: z.string().min(1),
    date: z.string().min(1),
    mode: z.enum(["CASH", "BANK_TRANSFER", "CHEQUE", "UPI", "CARD", "OTHER"]),
    reference: z.string().max(200).optional(),
    projectId: z.string().optional(),
    note: z.string().max(2000).optional(),
    description: z.string().max(5000).optional(),
  })
  .strict();

export async function createVendorPayment(input: unknown): Promise<
  ActionResult<{
    transactionId: string;
    date: string;
    vendorId: string;
    projectId: string | null;
    grossAmount: string;
    cashPaid: string;
    tdsAmount: string;
    tdsRatePct: number;
    tdsReason: string;
  }>
> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } };

  const parsed = createVendorPaymentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION", message: "Invalid input", fieldErrors: zodToFieldErrors(parsed.error) } };
  }

  const payDate = parseDateOnly(parsed.data.date);
  const fyStart = fyStartForIndia(payDate);
  const hasTransporterDeclaration = parsed.data.hasTransporterDeclaration ?? false;

  try {
    type TxResult =
      | {
          ok: true;
          transactionId: string;
          grossAmount: Prisma.Decimal;
          cashPaid: Prisma.Decimal;
          tdsAmount: Prisma.Decimal;
          tdsRatePct: number;
          tdsReason: string;
          projectId: string | null;
        }
      | { ok: false; error: ActionError };

    const result: TxResult = await prisma.$transaction(async (tx): Promise<TxResult> => {
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

      // This flow is specifically for Vendor/Subcontractor payments. Always run 194C logic.
      const ratePct = determineTDS194CRatePct({
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
      });

      const ytd = await tx.transaction.aggregate({
        where: {
          tenantId: session.user.tenantId,
          vendorId: parsed.data.vendorId,
          type: "EXPENSE",
          date: { gte: fyStart, lt: payDate },
        },
        _sum: { tdsBaseAmount: true },
      });
      const ytdBase = ytd._sum.tdsBaseAmount ?? new Prisma.Decimal(0);

      const allocations = parsed.data.allocations ?? [];
      const invoiceIds = [...new Set(allocations.map((a) => a.purchaseInvoiceId))];
      const invoices = invoiceIds.length
        ? await tx.purchaseInvoice.findMany({
            where: { tenantId: session.user.tenantId, id: { in: invoiceIds } },
            select: { id: true, vendorId: true, projectId: true, taxableValue: true, total: true },
          })
        : [];
      if (invoiceIds.length && invoices.length !== invoiceIds.length) {
        return { ok: false, error: { code: "VALIDATION", message: "One or more bills were not found." } };
      }
      if (invoices.some((i) => i.vendorId !== parsed.data.vendorId)) {
        return { ok: false, error: { code: "VALIDATION", message: "One or more bills do not belong to this vendor." } };
      }
      if (parsed.data.projectId && invoices.some((i) => i.projectId !== parsed.data.projectId)) {
        return { ok: false, error: { code: "VALIDATION", message: "One or more bills do not belong to this project." } };
      }

      const invoiceById = new Map(invoices.map((i) => [i.id, i]));

      const grossTotal = allocations.length
        ? allocations.reduce((acc, a) => acc.add(new Prisma.Decimal(a.grossAmount)), new Prisma.Decimal(0))
        : new Prisma.Decimal(parsed.data.grossAmount!);

      const currentTaxableBase = allocations.length
        ? allocations.reduce((acc, a) => {
            const inv = invoiceById.get(a.purchaseInvoiceId);
            if (!inv) return acc;
            if (inv.total.lte(0)) return acc.add(new Prisma.Decimal(a.grossAmount));
            const ratio = inv.taxableValue.div(inv.total);
            return acc.add(new Prisma.Decimal(a.grossAmount).mul(ratio));
          }, new Prisma.Decimal(0))
        : grossTotal;

      const tdsCalc = calculateTDS194C({
        vendor: {
          legalType: vendor.legalType,
          pan: vendor.pan,
          isTransporter: vendor.isTransporter,
          transporterVehicleCount: vendor.transporterVehicleCount,
          tdsOverrideRate: vendor.tdsOverrideRate,
          tdsThresholdSingle: vendor.tdsThresholdSingle,
          tdsThresholdAnnual: vendor.tdsThresholdAnnual,
        },
        currentAmount: currentTaxableBase,
        ytdAmount: ytdBase,
        hasTransporterDeclaration,
      });

      const totalTds = tdsCalc.applicable ? tdsCalc.tdsAmount : new Prisma.Decimal(0);

      // Distribute TDS across bills proportional to taxable ratio; cash = gross - tds.
      const allocationRows = allocations.length
        ? (() => {
            const r = new Prisma.Decimal(ratePct).div(100);
            const unrounded = allocations.map((a) => {
              const inv = invoiceById.get(a.purchaseInvoiceId);
              const grossAmount = new Prisma.Decimal(a.grossAmount);
              if (!inv || inv.total.lte(0) || !tdsCalc.applicable) {
                return { id: a.purchaseInvoiceId, grossAmount, tdsAmount: new Prisma.Decimal(0) };
              }
              const ratio = inv.taxableValue.div(inv.total);
              const tdsAmount = grossAmount.mul(ratio).mul(r);
              return { id: a.purchaseInvoiceId, grossAmount, tdsAmount };
            });

            const rounded = unrounded.map((a) => ({ ...a, tdsAmount: a.tdsAmount.toDecimalPlaces(2) }));
            const sum = rounded.reduce((acc, a) => acc.add(a.tdsAmount), new Prisma.Decimal(0));
            let diff = totalTds.sub(sum);
            if (rounded.length > 0 && !diff.isZero()) {
              const last = rounded[rounded.length - 1]!;
              last.tdsAmount = last.tdsAmount.add(diff).toDecimalPlaces(2);
            }

            return rounded.map((a) => {
              const cashAmount = a.grossAmount.sub(a.tdsAmount);
              return {
                tenantId: session.user.tenantId,
                documentType: "PURCHASE_INVOICE" as const,
                documentId: a.id,
                cashAmount: cashAmount.toDecimalPlaces(2),
                tdsAmount: a.tdsAmount.toDecimalPlaces(2),
                grossAmount: a.grossAmount.toDecimalPlaces(2),
              };
            });
          })()
        : [];

      const cashPaid = grossTotal.sub(totalTds).toDecimalPlaces(2);

      const txn = await tx.transaction.create({
        data: {
          tenantId: session.user.tenantId,
          type: "EXPENSE",
          date: payDate,
          amount: cashPaid,
          tdsAmount: totalTds.toDecimalPlaces(2),
          tdsBaseAmount: currentTaxableBase.toDecimalPlaces(2),
          vendorId: parsed.data.vendorId,
          projectId: parsed.data.projectId?.trim() || null,
          mode: parsed.data.mode,
          reference: parsed.data.reference?.trim() || null,
          note: parsed.data.note?.trim() || null,
          description: parsed.data.description?.trim() || null,
        },
        select: { id: true, projectId: true },
      });

      if (allocationRows.length) {
        await tx.transactionAllocation.createMany({
          data: allocationRows.map((a) => ({
            tenantId: a.tenantId,
            transactionId: txn.id,
            documentType: a.documentType,
            documentId: a.documentId,
            projectId: txn.projectId,
            cashAmount: a.cashAmount,
            tdsAmount: a.tdsAmount,
            grossAmount: a.grossAmount,
          })),
        });
      }

      return {
        ok: true,
        transactionId: txn.id,
        grossAmount: grossTotal.toDecimalPlaces(2),
        cashPaid,
        tdsAmount: totalTds.toDecimalPlaces(2),
        tdsRatePct: ratePct,
        tdsReason: tdsCalc.reason,
        projectId: txn.projectId,
      };
    });

    if (!result.ok) return { ok: false, error: result.error };

    return {
      ok: true,
      data: {
        transactionId: result.transactionId,
        date: payDate.toISOString().slice(0, 10),
        vendorId: parsed.data.vendorId,
        projectId: result.projectId,
        grossAmount: result.grossAmount.toString(),
        cashPaid: result.cashPaid.toString(),
        tdsAmount: result.tdsAmount.toString(),
        tdsRatePct: result.tdsRatePct,
        tdsReason: result.tdsReason,
      },
    };
  } catch {
    return unknownError("Failed to record vendor payment.");
  }
}

export async function updateVendorPaymentMeta(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } };

  const parsed = updateVendorPaymentMetaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION", message: "Invalid input", fieldErrors: zodToFieldErrors(parsed.error) } };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const txn = await tx.transaction.findFirst({
        where: { tenantId: session.user.tenantId, id: parsed.data.id, type: "EXPENSE", vendorId: { not: null } },
        select: { id: true },
      });
      if (!txn) throw new Error("Payment not found.");

      const projectId = parsed.data.projectId?.trim() || null;

      await tx.transaction.update({
        where: { tenantId: session.user.tenantId, id: parsed.data.id },
        data: {
          date: parseDateOnly(parsed.data.date),
          mode: parsed.data.mode,
          reference: parsed.data.reference?.trim() || null,
          projectId,
          note: parsed.data.note?.trim() || null,
          description: parsed.data.description?.trim() || null,
        },
        select: { id: true },
      });

      // Keep allocations in the same project bucket as the payment transaction.
      await tx.transactionAllocation.updateMany({
        where: { tenantId: session.user.tenantId, transactionId: parsed.data.id },
        data: { projectId },
      });
    });

    revalidatePath("/app/purchases/payments-made");
    revalidatePath("/app/transactions");
    revalidatePath(`/app/purchases/payments-made/${parsed.data.id}`);

    return { ok: true, data: { id: parsed.data.id } };
  } catch (e) {
    return unknownError(e instanceof Error ? e.message : "Failed to update payment.");
  }
}

export async function deleteVendorPayment(id: string): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } };

  try {
    await prisma.$transaction(async (tx) => {
      const txn = await tx.transaction.findFirst({
        where: { tenantId: session.user.tenantId, id, type: "EXPENSE", vendorId: { not: null } },
        select: { id: true },
      });
      if (!txn) throw new Error("Payment not found.");

      await tx.attachment.deleteMany({
        where: { tenantId: session.user.tenantId, entityType: "TRANSACTION", entityId: id },
      });

      // Allocations cascade, but deleting explicitly keeps behavior consistent across DBs.
      await tx.transactionAllocation.deleteMany({ where: { tenantId: session.user.tenantId, transactionId: id } });
      await tx.transaction.delete({ where: { tenantId: session.user.tenantId, id } });
    });

    revalidatePath("/app/purchases/payments-made");
    revalidatePath("/app/transactions");

    return { ok: true, data: { id } };
  } catch (e) {
    return unknownError(e instanceof Error ? e.message : "Failed to delete payment.");
  }
}
