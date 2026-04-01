"use server";

import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

import { type ActionResult, unknownError, zodToFieldErrors } from "./_result";

const vendorTdsPaymentSchema = z.object({
  vendorId: z.string().min(1),
  fy: z.string().regex(/^\d{4}-\d{2}$/, "Use FY like 2026-27"),
  section: z.string().min(1).max(20).default("194C"),
  challanNo: z.string().max(100).optional(),
  periodFrom: z.string().optional(),
  periodTo: z.string().optional(),
  tdsPaidAmount: z.coerce.number().positive(),
  paymentDate: z.string().min(1),
  note: z.string().max(2000).optional(),
});

function parseDateOnly(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid date");
  return date;
}

export async function createVendorTdsPayment(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } };

  const parsed = vendorTdsPaymentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION", message: "Invalid input", fieldErrors: zodToFieldErrors(parsed.error) } };
  }

  try {
    const created = await prisma.vendorTdsPayment.create({
      data: {
        tenantId: session.user.tenantId,
        vendorId: parsed.data.vendorId,
        fy: parsed.data.fy,
        section: parsed.data.section,
        challanNo: parsed.data.challanNo?.trim() || null,
        periodFrom: parsed.data.periodFrom ? parseDateOnly(parsed.data.periodFrom) : null,
        periodTo: parsed.data.periodTo ? parseDateOnly(parsed.data.periodTo) : null,
        tdsPaidAmount: new Prisma.Decimal(parsed.data.tdsPaidAmount),
        paymentDate: parseDateOnly(parsed.data.paymentDate),
        note: parsed.data.note?.trim() || null,
      },
      select: { id: true },
    });

    revalidatePath("/app/reports/tds-dashboard");
    return { ok: true, data: created };
  } catch {
    return unknownError("Failed to record vendor TDS payment.");
  }
}
