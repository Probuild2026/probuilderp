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
  const parsed = clientInvoiceCreateSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const msg =
      first?.path?.[0] === "invoiceNumber"
        ? "Invoice number is required."
        : "Please check the invoice details and try again.";
    throw new Error(msg);
  }

  const invoice = await prisma.clientInvoice.create({
    data: {
      tenantId: session.user.tenantId,
      projectId: parsed.data.projectId,
      clientId: parsed.data.clientId,
      invoiceNumber: parsed.data.invoiceNumber.trim(),
      invoiceDate: parseDateOnly(parsed.data.invoiceDate),
      dueDate: optionalDateOnly(parsed.data.dueDate),
      serviceDescription: parsed.data.serviceDescription?.trim() ? parsed.data.serviceDescription.trim() : null,
      sacCode: parsed.data.sacCode?.trim() ? parsed.data.sacCode.trim() : null,
      gstRate: typeof parsed.data.gstRate === "number" ? parsed.data.gstRate : null,
      basicValue: parsed.data.basicValue,
      gstType: parsed.data.gstType,
      cgst: parsed.data.cgst ?? 0,
      sgst: parsed.data.sgst ?? 0,
      igst: parsed.data.igst ?? 0,
      total: parsed.data.total,
      tdsRate: typeof parsed.data.tdsRate === "number" ? parsed.data.tdsRate : null,
      tdsAmountExpected: typeof parsed.data.tdsAmountExpected === "number" ? parsed.data.tdsAmountExpected : null,
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
  const parsed = clientInvoiceUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const msg =
      first?.path?.[0] === "invoiceNumber"
        ? "Invoice number is required."
        : "Please check the invoice details and try again.";
    throw new Error(msg);
  }

  await prisma.clientInvoice.update({
    where: { id: parsed.data.id, tenantId: session.user.tenantId },
    data: {
      projectId: parsed.data.projectId,
      clientId: parsed.data.clientId,
      invoiceNumber: parsed.data.invoiceNumber.trim(),
      invoiceDate: parseDateOnly(parsed.data.invoiceDate),
      dueDate: optionalDateOnly(parsed.data.dueDate),
      serviceDescription: parsed.data.serviceDescription?.trim() ? parsed.data.serviceDescription.trim() : null,
      sacCode: parsed.data.sacCode?.trim() ? parsed.data.sacCode.trim() : null,
      gstRate: typeof parsed.data.gstRate === "number" ? parsed.data.gstRate : null,
      basicValue: parsed.data.basicValue,
      gstType: parsed.data.gstType,
      cgst: parsed.data.cgst ?? 0,
      sgst: parsed.data.sgst ?? 0,
      igst: parsed.data.igst ?? 0,
      total: parsed.data.total,
      tdsRate: typeof parsed.data.tdsRate === "number" ? parsed.data.tdsRate : null,
      tdsAmountExpected: typeof parsed.data.tdsAmountExpected === "number" ? parsed.data.tdsAmountExpected : null,
      // Status is derived from allocations; do not update stored field.
    },
  });

  revalidatePath("/app/sales/invoices");
  revalidatePath(`/app/sales/invoices/${parsed.data.id}`);
}

export async function deleteClientInvoice(id: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  await prisma.clientInvoice.delete({
    where: { id, tenantId: session.user.tenantId },
  });

  revalidatePath("/app/sales/invoices");
}
