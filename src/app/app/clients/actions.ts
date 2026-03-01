"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth/next";

import { clientCreateSchema, clientUpdateSchema } from "@/lib/validators/client";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

export async function createClient(input: unknown) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const parsed = clientCreateSchema.parse(input);
  const contactPerson = parsed.contactPerson?.trim() ? parsed.contactPerson.trim() : null;
  const phone = parsed.phone?.trim() ? parsed.phone.trim() : null;
  const email = parsed.email?.trim() ? parsed.email.trim() : null;
  const billingAddress = parsed.billingAddress?.trim() ? parsed.billingAddress.trim() : null;
  const siteAddress = parsed.siteAddress?.trim() ? parsed.siteAddress.trim() : null;
  const gstin = parsed.gstin?.trim() ? parsed.gstin.trim() : null;
  const pan = parsed.pan?.trim() ? parsed.pan.trim() : null;
  const preferredPaymentMode = parsed.preferredPaymentMode?.trim() ? parsed.preferredPaymentMode.trim() : null;
  const notes = parsed.notes?.trim() ? parsed.notes.trim() : null;

  await prisma.client.create({
    data: {
      tenantId: session.user.tenantId,
      name: parsed.name,
      contactPerson,
      phone,
      email,
      billingAddress,
      siteAddress,
      gstin,
      pan,
      paymentTermsDays: parsed.paymentTermsDays ?? null,
      preferredPaymentMode,
      notes,
    },
  });

  revalidatePath("/app/clients");
}

export async function updateClient(input: unknown) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const parsed = clientUpdateSchema.parse(input);
  const contactPerson = parsed.contactPerson?.trim() ? parsed.contactPerson.trim() : null;
  const phone = parsed.phone?.trim() ? parsed.phone.trim() : null;
  const email = parsed.email?.trim() ? parsed.email.trim() : null;
  const billingAddress = parsed.billingAddress?.trim() ? parsed.billingAddress.trim() : null;
  const siteAddress = parsed.siteAddress?.trim() ? parsed.siteAddress.trim() : null;
  const gstin = parsed.gstin?.trim() ? parsed.gstin.trim() : null;
  const pan = parsed.pan?.trim() ? parsed.pan.trim() : null;
  const preferredPaymentMode = parsed.preferredPaymentMode?.trim() ? parsed.preferredPaymentMode.trim() : null;
  const notes = parsed.notes?.trim() ? parsed.notes.trim() : null;

  await prisma.client.update({
    where: { tenantId: session.user.tenantId, id: parsed.id },
    data: {
      name: parsed.name,
      contactPerson,
      phone,
      email,
      billingAddress,
      siteAddress,
      gstin,
      pan,
      paymentTermsDays: parsed.paymentTermsDays ?? null,
      preferredPaymentMode,
      notes,
    },
  });

  revalidatePath("/app/clients");
  revalidatePath(`/app/clients/${parsed.id}`);
}
