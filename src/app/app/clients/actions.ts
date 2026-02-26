"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth/next";

import { clientCreateSchema } from "@/lib/validators/client";
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
  const gstin = parsed.gstin?.trim() ? parsed.gstin.trim() : null;
  const pan = parsed.pan?.trim() ? parsed.pan.trim() : null;

  await prisma.client.create({
    data: {
      tenantId: session.user.tenantId,
      name: parsed.name,
      contactPerson,
      phone,
      email,
      billingAddress,
      gstin,
      pan,
    },
  });

  revalidatePath("/app/clients");
}

