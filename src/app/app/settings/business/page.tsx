import { getServerSession } from "next-auth/next";

import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

import { BusinessSettingsForm } from "./business-settings-form";

export default async function BusinessSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const profile = await prisma.tenantProfile.findUnique({
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

