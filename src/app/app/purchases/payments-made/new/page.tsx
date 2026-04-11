import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";

import { ModuleCheatSheet } from "@/components/help/module-cheat-sheet";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

import { VendorPaymentCreateForm } from "./vendor-payment-create-form";

export default async function NewPaymentMadePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const sp = (await searchParams) ?? {};
  const prefillVendorId = typeof sp.vendorId === "string" ? sp.vendorId : undefined;
  const prefillProjectId = typeof sp.projectId === "string" ? sp.projectId : undefined;
  const prefillBillId = typeof sp.billId === "string" ? sp.billId : undefined;
  const prefillAmount = typeof sp.amount === "string" ? sp.amount : undefined;

  const [projects, vendors] = await Promise.all([
    prisma.project.findMany({
      where: { tenantId: session.user.tenantId },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true },
      take: 200,
    }),
    prisma.vendor.findMany({
      where: { tenantId: session.user.tenantId },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, isSubcontractor: true },
      take: 200,
    }),
  ]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold">New Vendor Payment</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick a vendor/subcontractor, optionally settle bills, and the app will auto-calculate TDS (194C) and net cash paid.
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div>
          <VendorPaymentCreateForm
            today={today}
            projects={projects}
            vendors={vendors}
            initial={{
              vendorId: prefillVendorId,
              projectId: prefillProjectId,
              billId: prefillBillId,
              amount: prefillAmount,
            }}
          />
        </div>
        <ModuleCheatSheet
          moduleKey="paymentsMade"
          variant="sidebar"
          showRoutingTrigger
          className="order-first lg:order-none"
        />
      </div>
    </div>
  );
}
