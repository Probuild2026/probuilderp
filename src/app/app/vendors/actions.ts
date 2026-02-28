"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";

import { vendorCreateSchema } from "@/lib/validators/vendor";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

export async function createVendor(input: unknown) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const parsed = vendorCreateSchema.parse(input);
  const trade = parsed.trade?.trim() ? parsed.trade.trim() : null;
  const gstin = parsed.gstin?.trim() ? parsed.gstin.trim() : null;
  const pan = parsed.pan?.trim() ? parsed.pan.trim() : null;
  const phone = parsed.phone?.trim() ? parsed.phone.trim() : null;
  const email = parsed.email?.trim() ? parsed.email.trim() : null;
  const address = parsed.address?.trim() ? parsed.address.trim() : null;

  await prisma.vendor.create({
    data: {
      tenantId: session.user.tenantId,
      name: parsed.name,
      trade,
      gstin,
      pan,
      phone,
      email,
      address,
      isSubcontractor: parsed.isSubcontractor,
      legalType: parsed.legalType,
      active: parsed.active,
      tdsSection: parsed.tdsSection,
      tdsOverrideRate: parsed.tdsOverrideRate == null ? null : new Prisma.Decimal(parsed.tdsOverrideRate),
      tdsThresholdSingle: new Prisma.Decimal(parsed.tdsThresholdSingle),
      tdsThresholdAnnual: new Prisma.Decimal(parsed.tdsThresholdAnnual),
      isTransporter: parsed.isTransporter,
      transporterVehicleCount: parsed.isTransporter ? (parsed.transporterVehicleCount ?? null) : null,
    },
  });

  revalidatePath("/app/vendors");
}
