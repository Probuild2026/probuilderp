import { getServerSession } from "next-auth/next";

import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";
import { Prisma } from "@prisma/client";

import { BusinessSettingsForm } from "./business-settings-form";

export default async function BusinessSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  let profile:
    | {
        legalName: string;
        tradeName: string | null;
        brandName: string | null;
        primaryColor: string | null;
        accentColor: string | null;
        phone: string | null;
        email: string | null;
        address: string | null;
        gstin: string | null;
        pan: string | null;
        bankName: string | null;
        bankAccountNo: string | null;
        bankIfsc: string | null;
        upiId: string | null;
        logoUrl: string | null;
      }
    | null = null;

  try {
    profile = await prisma.tenantProfile.findUnique({
      where: { tenantId: session.user.tenantId },
      select: {
        legalName: true,
        tradeName: true,
        brandName: true,
        primaryColor: true,
        accentColor: true,
        phone: true,
        email: true,
        address: true,
        gstin: true,
        pan: true,
        bankName: true,
        bankAccountNo: true,
        bankIfsc: true,
        upiId: true,
        logoUrl: true,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2022") {
      const res = await prisma.tenantProfile.findUnique({
        where: { tenantId: session.user.tenantId },
        select: {
          legalName: true,
          tradeName: true,
          phone: true,
          email: true,
          address: true,
          gstin: true,
          pan: true,
          bankName: true,
          bankAccountNo: true,
          bankIfsc: true,
          upiId: true,
          logoUrl: true,
        },
      });

      profile = res
        ? {
            legalName: res.legalName,
            tradeName: res.tradeName ?? null,
            brandName: null,
            primaryColor: null,
            accentColor: null,
            phone: res.phone ?? null,
            email: res.email ?? null,
            address: res.address ?? null,
            gstin: res.gstin ?? null,
            pan: res.pan ?? null,
            bankName: res.bankName ?? null,
            bankAccountNo: res.bankAccountNo ?? null,
            bankIfsc: res.bankIfsc ?? null,
            upiId: res.upiId ?? null,
            logoUrl: res.logoUrl ?? null,
          }
        : null;
    } else {
      throw e;
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Business Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Company details used on invoices, receipts, vouchers, and exports.
        </p>
      </div>

      <BusinessSettingsForm tenantId={session.user.tenantId} profile={profile} />
    </div>
  );
}
