"use server";

import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { z } from "zod";

import { calcInvoiceBalance, calcInvoicePaidAmount, calcInvoiceStatus } from "@/lib/finance";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

import { type ActionResult, unknownError, zodToFieldErrors } from "./_result";

const invoiceCreateSchema = z.object({
  projectId: z.string().min(1),
  clientId: z.string().min(1),
  invoiceNumber: z.string().min(1).max(50),
  invoiceDate: z.string().min(1),
  dueDate: z.string().optional(),
  status: z.string().min(1).max(50).default("SENT"),
  serviceDescription: z.string().max(5000).optional(),
  sacCode: z.string().max(20).optional(),
  gstType: z.enum(["INTRA", "INTER"]),
  gstRate: z.coerce.number().min(0).max(100).optional(),
  basicValue: z.coerce.number().nonnegative(),
  cgst: z.coerce.number().nonnegative().optional(),
  sgst: z.coerce.number().nonnegative().optional(),
  igst: z.coerce.number().nonnegative().optional(),
  total: z.coerce.number().nonnegative(),
  tdsRate: z.coerce.number().min(0).max(100).optional(),
  tdsAmountExpected: z.coerce.number().nonnegative().optional(),
  tdsCertificateNumber: z.string().max(100).optional(),
});

const invoiceUpdateSchema = invoiceCreateSchema.extend({
  id: z.string().min(1),
});

const invoiceListSchema = z.object({
  projectId: z.string().optional(),
  clientId: z.string().optional(),
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

export async function createInvoice(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } };

  const parsed = invoiceCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION", message: "Invalid input", fieldErrors: zodToFieldErrors(parsed.error) } };
  }

  try {
    const created = await prisma.clientInvoice.create({
      data: {
        tenantId: session.user.tenantId,
        projectId: parsed.data.projectId,
        clientId: parsed.data.clientId,
        invoiceNumber: parsed.data.invoiceNumber.trim(),
        invoiceDate: parseDateOnly(parsed.data.invoiceDate),
        dueDate: optionalDate(parsed.data.dueDate),
        status: parsed.data.status.trim(),
        serviceDescription: parsed.data.serviceDescription?.trim() || null,
        sacCode: parsed.data.sacCode?.trim() || null,
        gstRate: typeof parsed.data.gstRate === "number" ? new Prisma.Decimal(parsed.data.gstRate) : null,
        gstType: parsed.data.gstType,
        basicValue: new Prisma.Decimal(parsed.data.basicValue),
        cgst: new Prisma.Decimal(parsed.data.cgst ?? 0),
        sgst: new Prisma.Decimal(parsed.data.sgst ?? 0),
        igst: new Prisma.Decimal(parsed.data.igst ?? 0),
        total: new Prisma.Decimal(parsed.data.total),
        tdsRate: typeof parsed.data.tdsRate === "number" ? new Prisma.Decimal(parsed.data.tdsRate) : null,
        tdsAmountExpected:
          typeof parsed.data.tdsAmountExpected === "number" ? new Prisma.Decimal(parsed.data.tdsAmountExpected) : null,
        tdsCertificateNumber: parsed.data.tdsCertificateNumber?.trim() || null,
        receivedAmount: new Prisma.Decimal(0),
      },
      select: { id: true },
    });

    return { ok: true, data: created };
  } catch {
    return unknownError("Failed to create invoice.");
  }
}

export async function updateInvoice(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } };

  const parsed = invoiceUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION", message: "Invalid input", fieldErrors: zodToFieldErrors(parsed.error) } };
  }

  try {
    const updated = await prisma.clientInvoice.update({
      where: { id: parsed.data.id, tenantId: session.user.tenantId },
      data: {
        projectId: parsed.data.projectId,
        clientId: parsed.data.clientId,
        invoiceNumber: parsed.data.invoiceNumber.trim(),
        invoiceDate: parseDateOnly(parsed.data.invoiceDate),
        dueDate: optionalDate(parsed.data.dueDate),
        status: parsed.data.status.trim(),
        serviceDescription: parsed.data.serviceDescription?.trim() || null,
        sacCode: parsed.data.sacCode?.trim() || null,
        gstRate: typeof parsed.data.gstRate === "number" ? new Prisma.Decimal(parsed.data.gstRate) : null,
        gstType: parsed.data.gstType,
        basicValue: new Prisma.Decimal(parsed.data.basicValue),
        cgst: new Prisma.Decimal(parsed.data.cgst ?? 0),
        sgst: new Prisma.Decimal(parsed.data.sgst ?? 0),
        igst: new Prisma.Decimal(parsed.data.igst ?? 0),
        total: new Prisma.Decimal(parsed.data.total),
        tdsRate: typeof parsed.data.tdsRate === "number" ? new Prisma.Decimal(parsed.data.tdsRate) : null,
        tdsAmountExpected:
          typeof parsed.data.tdsAmountExpected === "number" ? new Prisma.Decimal(parsed.data.tdsAmountExpected) : null,
        tdsCertificateNumber: parsed.data.tdsCertificateNumber?.trim() || null,
      },
      select: { id: true },
    });

    return { ok: true, data: updated };
  } catch {
    return unknownError("Failed to update invoice.");
  }
}

export async function listInvoices(input: unknown): Promise<
  ActionResult<{
    items: Array<{
      id: string;
      invoiceNumber: string;
      invoiceDate: string;
      dueDate: string | null;
      total: string;
      paidAmount: string;
      balance: string;
      computedStatus: ReturnType<typeof calcInvoiceStatus>;
      projectId: string;
      clientId: string;
    }>;
    total: number;
  }>
> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } };

  const parsed = invoiceListSchema.safeParse(input ?? {});
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION", message: "Invalid input", fieldErrors: zodToFieldErrors(parsed.error) } };
  }

  const where = {
    tenantId: session.user.tenantId,
    ...(parsed.data.projectId ? { projectId: parsed.data.projectId } : {}),
    ...(parsed.data.clientId ? { clientId: parsed.data.clientId } : {}),
  };

  try {
    const [items, total, allocSums] = await prisma.$transaction([
      prisma.clientInvoice.findMany({
        where,
        orderBy: [{ invoiceDate: "desc" }, { createdAt: "desc" }],
        take: parsed.data.take,
        skip: parsed.data.skip,
        select: {
          id: true,
          projectId: true,
          clientId: true,
          invoiceNumber: true,
          invoiceDate: true,
          dueDate: true,
          total: true,
          status: true,
        },
      }),
      prisma.clientInvoice.count({ where }),
      prisma.transactionAllocation.groupBy({
        by: ["documentId"],
        where: { tenantId: session.user.tenantId, documentType: "CLIENT_INVOICE" },
        orderBy: { documentId: "asc" },
        _sum: { cashAmount: true, tdsAmount: true },
      }),
    ]);

    const byInvoiceId = new Map<string, { cash: Prisma.Decimal; tds: Prisma.Decimal }>();
    for (const a of allocSums) {
      byInvoiceId.set(a.documentId, {
        cash: a._sum?.cashAmount ?? new Prisma.Decimal(0),
        tds: a._sum?.tdsAmount ?? new Prisma.Decimal(0),
      });
    }

    const today = new Date();
    const mapped = items.map((inv) => {
      const sums = byInvoiceId.get(inv.id) ?? { cash: new Prisma.Decimal(0), tds: new Prisma.Decimal(0) };
      const invoiceLike = { total: inv.total, dueDate: inv.dueDate, status: inv.status };
      const paidAmount = calcInvoicePaidAmount(invoiceLike, [{ cashAmount: sums.cash, tdsAmount: sums.tds }]);
      const balance = calcInvoiceBalance(invoiceLike, [{ cashAmount: sums.cash, tdsAmount: sums.tds }]);
      const computedStatus = calcInvoiceStatus(invoiceLike, [{ cashAmount: sums.cash, tdsAmount: sums.tds }], today);

      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: inv.invoiceDate.toISOString().slice(0, 10),
        dueDate: inv.dueDate ? inv.dueDate.toISOString().slice(0, 10) : null,
        total: inv.total.toString(),
        paidAmount: paidAmount.toString(),
        balance: balance.toString(),
        computedStatus,
        projectId: inv.projectId,
        clientId: inv.clientId,
      };
    });

    return { ok: true, data: { items: mapped, total } };
  } catch {
    return unknownError("Failed to load invoices.");
  }
}

