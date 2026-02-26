"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth/next";

import { parseCsv } from "@/lib/csv";
import { parseMoney, parsePercent } from "@/lib/money";
import {
  paymentScheduleImportSchema,
  paymentStageUpsertSchema,
} from "@/lib/validators/payment-schedule";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

function parseDateOnly(value?: string) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function upsertPaymentStage(input: unknown) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const parsed = paymentStageUpsertSchema.parse(input);

  const data = {
    tenantId: session.user.tenantId,
    projectId: parsed.projectId,
    stageName: parsed.stageName.trim(),
    scopeOfWork: parsed.scopeOfWork?.trim() ? parsed.scopeOfWork.trim() : null,
    percent: typeof parsed.percent === "number" ? parsed.percent : null,
    expectedAmount: parsed.expectedAmount,
    expectedBank: parsed.expectedBank ?? 0,
    expectedCash: parsed.expectedCash ?? 0,
    actualBank: parsed.actualBank ?? 0,
    actualCash: parsed.actualCash ?? 0,
    expectedDate: parseDateOnly(parsed.expectedDate),
    actualDate: parseDateOnly(parsed.actualDate),
    notes: parsed.notes?.trim() ? parsed.notes.trim() : null,
    sortOrder: parsed.sortOrder ?? 0,
  } as const;

  if (parsed.id) {
    await prisma.projectPaymentStage.update({
      where: { id: parsed.id, tenantId: session.user.tenantId },
      data,
    });
  } else {
    await prisma.projectPaymentStage.create({ data });
  }

  revalidatePath(`/app/projects/${parsed.projectId}`);
}

export async function deletePaymentStage(id: string, projectId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  await prisma.projectPaymentStage.delete({
    where: { id, tenantId: session.user.tenantId },
  });

  revalidatePath(`/app/projects/${projectId}`);
}

export async function importPaymentScheduleCsv(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const raw = Object.fromEntries(formData.entries());
  const { projectId } = paymentScheduleImportSchema.parse(raw);

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) throw new Error("CSV file is required.");

  const text = await file.text();
  const rows = parseCsv(text);

  // wipe existing schedule (safe for "edit as needed" workflow)
  await prisma.projectPaymentStage.deleteMany({
    where: { tenantId: session.user.tenantId, projectId },
  });

  let sortOrder = 1;
  for (const r of rows) {
    const stageName = r["stage"]?.trim();
    if (!stageName) continue;

    const scopeOfWork = r["scope of work"]?.trim() ?? "";
    const percent = parsePercent(r["%"]);

    const expectedAmount = parseMoney(r["amount (₹)"]);
    const expectedBank = parseMoney(r["bank (₹)"]);
    const expectedCash = parseMoney(r["cash (₹)"]);

    const actualBank = parseMoney(r["bank payment"]);
    const actualCash = parseMoney(r["cash received"]);

    await prisma.projectPaymentStage.create({
      data: {
        tenantId: session.user.tenantId,
        projectId,
        stageName,
        scopeOfWork: scopeOfWork || null,
        percent,
        expectedAmount,
        expectedBank,
        expectedCash,
        actualBank,
        actualCash,
        sortOrder,
      },
    });

    sortOrder += 1;
  }

  revalidatePath(`/app/projects/${projectId}`);
}

