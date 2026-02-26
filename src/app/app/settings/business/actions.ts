"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

function optionalString(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export async function upsertTenantProfile(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const logoUrl = formData.get("logoUrl");
  const logoName = formData.get("logoName");
  const logoMimeType = formData.get("logoMimeType");
  const logoSize = formData.get("logoSize");

  const legalName = optionalString(formData.get("legalName"));
  if (!legalName) throw new Error("Legal name is required.");

  await prisma.tenantProfile.upsert({
    where: { tenantId: session.user.tenantId },
    update: {
      legalName,
      tradeName: optionalString(formData.get("tradeName")),
      phone: optionalString(formData.get("phone")),
      email: optionalString(formData.get("email")),
      address: optionalString(formData.get("address")),
      gstin: optionalString(formData.get("gstin")),
      pan: optionalString(formData.get("pan")),
      bankName: optionalString(formData.get("bankName")),
      bankAccountNo: optionalString(formData.get("bankAccountNo")),
      bankIfsc: optionalString(formData.get("bankIfsc")),
      upiId: optionalString(formData.get("upiId")),
      ...(typeof logoUrl === "string" && logoUrl.length
        ? {
            logoUrl,
            logoName: typeof logoName === "string" ? logoName : null,
            logoMimeType: typeof logoMimeType === "string" ? logoMimeType : null,
            logoSize: typeof logoSize === "string" ? Number(logoSize) || null : null,
          }
        : {}),
    },
    create: {
      tenantId: session.user.tenantId,
      legalName,
      tradeName: optionalString(formData.get("tradeName")),
      phone: optionalString(formData.get("phone")),
      email: optionalString(formData.get("email")),
      address: optionalString(formData.get("address")),
      gstin: optionalString(formData.get("gstin")),
      pan: optionalString(formData.get("pan")),
      bankName: optionalString(formData.get("bankName")),
      bankAccountNo: optionalString(formData.get("bankAccountNo")),
      bankIfsc: optionalString(formData.get("bankIfsc")),
      upiId: optionalString(formData.get("upiId")),
      logoUrl: typeof logoUrl === "string" && logoUrl.length ? logoUrl : null,
      logoName: typeof logoName === "string" && logoName.length ? logoName : null,
      logoMimeType: typeof logoMimeType === "string" && logoMimeType.length ? logoMimeType : null,
      logoSize: typeof logoSize === "string" ? Number(logoSize) || null : null,
    },
  });

  revalidatePath("/app/settings/business");
}

