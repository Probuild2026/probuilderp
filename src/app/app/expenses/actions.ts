"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth/next";

import { expenseCreateSchema, expenseUpdateSchema } from "@/lib/validators/expense";
import { authOptions } from "@/server/auth";
import { safeWriteAuditLog } from "@/server/audit";
import { prisma } from "@/server/db";
import { saveUploadToDisk, tryDeleteStoredFile } from "@/server/storage";

function parseDateOnly(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid date");
  return date;
}

export async function createExpense(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const billUrl = formData.get("billUrl");
  const billName = formData.get("billName");
  const billType = formData.get("billType");
  const billSize = formData.get("billSize");

  const raw = Object.fromEntries(formData.entries());
  const parsed = expenseCreateSchema.parse(raw);

  const amountBeforeTax = parsed.amountBeforeTax;
  const cgst = parsed.cgst ?? 0;
  const sgst = parsed.sgst ?? 0;
  const igst = parsed.igst ?? 0;

  const expense = await prisma.expense.create({
    data: {
      tenantId: session.user.tenantId,
      projectId: parsed.projectId,
      vendorId: parsed.vendorId?.trim() ? parsed.vendorId.trim() : null,
      labourerId: parsed.labourerId?.trim() ? parsed.labourerId.trim() : null,
      date: parseDateOnly(parsed.date),
      amountBeforeTax,
      cgst,
      sgst,
      igst,
      totalAmount: amountBeforeTax + cgst + sgst + igst,
      paymentMode: parsed.paymentMode ?? null,
      narration: parsed.narration?.trim() ? parsed.narration.trim() : null,
      expenseType: parsed.expenseType,
      paymentStatus: parsed.paymentMode ? "PAID" : "UNPAID",
    },
  });

  const file = formData.get("bill");
  if (typeof billUrl === "string" && billUrl.length) {
    await prisma.attachment.create({
      data: {
        tenantId: session.user.tenantId,
        entityType: "EXPENSE",
        entityId: expense.id,
        projectId: expense.projectId,
        originalName: typeof billName === "string" && billName ? billName : "upload",
        mimeType: typeof billType === "string" && billType ? billType : "application/octet-stream",
        size: typeof billSize === "string" ? Number(billSize) || 0 : 0,
        storagePath: billUrl,
        uploadedById: session.user.id,
      },
    });
  } else if (file instanceof File && file.size > 0) {
    const saved = await saveUploadToDisk({
      tenantId: session.user.tenantId,
      entityPath: `expenses/${expense.id}`,
      file,
    });

    await prisma.attachment.create({
      data: {
        tenantId: session.user.tenantId,
        entityType: "EXPENSE",
        entityId: expense.id,
        projectId: expense.projectId,
        originalName: saved.originalName,
        mimeType: saved.mimeType,
        size: saved.size,
        storagePath: saved.storagePath,
        uploadedById: session.user.id,
      },
    });
  }

  await safeWriteAuditLog({
    tenantId: session.user.tenantId,
    userId: session.user.id,
    userEmail: session.user.email,
    action: "CREATE",
    entityType: "EXPENSE",
    entityId: expense.id,
    summary: "Expense created.",
    metadata: {
      projectId: expense.projectId,
      vendorId: expense.vendorId,
      labourerId: expense.labourerId,
      totalAmount: Number(expense.totalAmount),
      expenseType: expense.expenseType,
    },
  });

  revalidatePath("/app/expenses");
}

export async function updateExpense(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const billUrl = formData.get("billUrl");
  const billName = formData.get("billName");
  const billType = formData.get("billType");
  const billSize = formData.get("billSize");

  const raw = Object.fromEntries(formData.entries());
  const parsed = expenseUpdateSchema.parse(raw);

  const amountBeforeTax = parsed.amountBeforeTax;
  const cgst = parsed.cgst ?? 0;
  const sgst = parsed.sgst ?? 0;
  const igst = parsed.igst ?? 0;

  const expense = await prisma.expense.update({
    where: { id: parsed.id, tenantId: session.user.tenantId },
    data: {
      projectId: parsed.projectId,
      vendorId: parsed.vendorId?.trim() ? parsed.vendorId.trim() : null,
      labourerId: parsed.labourerId?.trim() ? parsed.labourerId.trim() : null,
      date: parseDateOnly(parsed.date),
      amountBeforeTax,
      cgst,
      sgst,
      igst,
      totalAmount: amountBeforeTax + cgst + sgst + igst,
      paymentMode: parsed.paymentMode ?? null,
      narration: parsed.narration?.trim() ? parsed.narration.trim() : null,
      expenseType: parsed.expenseType,
      paymentStatus: parsed.paymentMode ? "PAID" : "UNPAID",
    },
  });

  const file = formData.get("bill");
  if (typeof billUrl === "string" && billUrl.length) {
    await prisma.attachment.create({
      data: {
        tenantId: session.user.tenantId,
        entityType: "EXPENSE",
        entityId: expense.id,
        projectId: expense.projectId,
        originalName: typeof billName === "string" && billName ? billName : "upload",
        mimeType: typeof billType === "string" && billType ? billType : "application/octet-stream",
        size: typeof billSize === "string" ? Number(billSize) || 0 : 0,
        storagePath: billUrl,
        uploadedById: session.user.id,
      },
    });
  } else if (file instanceof File && file.size > 0) {
    const saved = await saveUploadToDisk({
      tenantId: session.user.tenantId,
      entityPath: `expenses/${expense.id}`,
      file,
    });

    await prisma.attachment.create({
      data: {
        tenantId: session.user.tenantId,
        entityType: "EXPENSE",
        entityId: expense.id,
        projectId: expense.projectId,
        originalName: saved.originalName,
        mimeType: saved.mimeType,
        size: saved.size,
        storagePath: saved.storagePath,
        uploadedById: session.user.id,
      },
    });
  }

  await safeWriteAuditLog({
    tenantId: session.user.tenantId,
    userId: session.user.id,
    userEmail: session.user.email,
    action: "UPDATE",
    entityType: "EXPENSE",
    entityId: expense.id,
    summary: "Expense updated.",
    metadata: {
      projectId: expense.projectId,
      vendorId: expense.vendorId,
      labourerId: expense.labourerId,
      totalAmount: Number(expense.totalAmount),
      expenseType: expense.expenseType,
    },
  });

  revalidatePath("/app/expenses");
  revalidatePath(`/app/expenses/${expense.id}`);
}

export async function deleteExpense(id: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const expense = await prisma.expense.findFirst({
    where: { id, tenantId: session.user.tenantId },
    select: { id: true, projectId: true, vendorId: true, labourerId: true, totalAmount: true, expenseType: true },
  });
  if (!expense) throw new Error("Expense not found");

  const attachments = await prisma.attachment.findMany({
    where: { tenantId: session.user.tenantId, entityType: "EXPENSE", entityId: id },
    select: { id: true, storagePath: true },
  });

  await prisma.attachment.deleteMany({
    where: { tenantId: session.user.tenantId, entityType: "EXPENSE", entityId: id },
  });
  await prisma.expense.delete({
    where: { id, tenantId: session.user.tenantId },
  });

  await Promise.allSettled(attachments.map((a) => tryDeleteStoredFile(a.storagePath)));

  await safeWriteAuditLog({
    tenantId: session.user.tenantId,
    userId: session.user.id,
    userEmail: session.user.email,
    action: "DELETE",
    entityType: "EXPENSE",
    entityId: expense.id,
    summary: "Expense deleted.",
    metadata: {
      projectId: expense.projectId,
      vendorId: expense.vendorId,
      labourerId: expense.labourerId,
      totalAmount: Number(expense.totalAmount),
      expenseType: expense.expenseType,
    },
  });

  revalidatePath("/app/expenses");
}
