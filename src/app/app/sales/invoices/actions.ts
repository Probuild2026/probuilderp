"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth/next";

import { clientInvoiceCreateSchema, clientInvoiceUpdateSchema } from "@/lib/validators/client-invoice";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

function parseDateOnly(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid date");
  return date;
}

function optionalDateOnly(value: string | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return parseDateOnly(trimmed);
}

export async function createClientInvoice(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const raw = Object.fromEntries(formData.entries());
  const parsed = clientInvoiceCreateSchema.parse(raw);

  const invoice = await prisma.clientInvoice.create({
    data: {
      tenantId: session.user.tenantId,
      projectId: parsed.projectId,
      clientId: parsed.clientId,
      invoiceNumber: parsed.invoiceNumber.trim(),
      invoiceDate: parseDateOnly(parsed.invoiceDate),
      dueDate: optionalDateOnly(parsed.dueDate),
      serviceDescription: parsed.serviceDescription?.trim() ? parsed.serviceDescription.trim() : null,
      sacCode: parsed.sacCode?.trim() ? parsed.sacCode.trim() : null,
      gstRate: typeof parsed.gstRate === "number" ? parsed.gstRate : null,
      basicValue: parsed.basicValue,
      gstType: parsed.gstType,
      cgst: parsed.cgst ?? 0,
      sgst: parsed.sgst ?? 0,
      igst: parsed.igst ?? 0,
      total: parsed.total,
      tdsRate: typeof parsed.tdsRate === "number" ? parsed.tdsRate : null,
      tdsAmountExpected: typeof parsed.tdsAmountExpected === "number" ? parsed.tdsAmountExpected : null,
      // Status is derived from allocations; keep stored field as legacy for now.
      status: "DUE",
    },
    select: { id: true },
  });

  revalidatePath("/app/sales/invoices");
  return invoice.id;
}

export async function updateClientInvoice(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const raw = Object.fromEntries(formData.entries());
  const parsed = clientInvoiceUpdateSchema.parse(raw);

  await prisma.clientInvoice.update({
    where: { id: parsed.id, tenantId: session.user.tenantId },
    data: {
      projectId: parsed.projectId,
      clientId: parsed.clientId,
      invoiceNumber: parsed.invoiceNumber.trim(),
      invoiceDate: parseDateOnly(parsed.invoiceDate),
      dueDate: optionalDateOnly(parsed.dueDate),
      serviceDescription: parsed.serviceDescription?.trim() ? parsed.serviceDescription.trim() : null,
      sacCode: parsed.sacCode?.trim() ? parsed.sacCode.trim() : null,
      gstRate: typeof parsed.gstRate === "number" ? parsed.gstRate : null,
      basicValue: parsed.basicValue,
      gstType: parsed.gstType,
      cgst: parsed.cgst ?? 0,
      sgst: parsed.sgst ?? 0,
      igst: parsed.igst ?? 0,
      total: parsed.total,
      tdsRate: typeof parsed.tdsRate === "number" ? parsed.tdsRate : null,
      tdsAmountExpected: typeof parsed.tdsAmountExpected === "number" ? parsed.tdsAmountExpected : null,
      // Status is derived from allocations; do not update stored field.
    },
  });

  revalidatePath("/app/sales/invoices");
  revalidatePath(`/app/sales/invoices/${parsed.id}`);
}

export async function deleteClientInvoice(id: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  await prisma.clientInvoice.delete({
    where: { id, tenantId: session.user.tenantId },
  });

  revalidatePath("/app/sales/invoices");
}
