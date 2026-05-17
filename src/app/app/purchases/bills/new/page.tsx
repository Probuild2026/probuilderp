import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";

import { ModuleCheatSheet } from "@/components/help/module-cheat-sheet";
import { Button } from "@/components/ui/button";
import { getSingleSearchParam } from "@/lib/date-range";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

import { BillForm } from "../_components/bill-form";

export default async function NewBillPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const sp = (await searchParams) ?? {};
  const receiptId = getSingleSearchParam(sp, "receiptId");
  const queryVendorId = getSingleSearchParam(sp, "vendorId");
  const queryProjectId = getSingleSearchParam(sp, "projectId");

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
      select: { id: true, name: true, gstin: true },
      take: 200,
    }),
  ]);

  const linkedReceipt = receiptId
    ? await prisma.materialReceipt.findFirst({
        where: { tenantId: session.user.tenantId, id: receiptId },
        select: {
          id: true,
          vendorId: true,
          projectId: true,
          item: { select: { name: true } },
          receiptDate: true,
          challanNumber: true,
        },
      })
    : null;

  const today = new Date().toISOString().slice(0, 10);
  const initialVendorId = linkedReceipt?.vendorId ?? (vendors.some((vendor) => vendor.id === queryVendorId) ? queryVendorId : undefined);
  const initialProjectId = linkedReceipt?.projectId ?? (projects.some((project) => project.id === queryProjectId) ? queryProjectId : undefined);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">New Bill</h1>
          <p className="mt-1 text-sm text-muted-foreground">Record a vendor bill (purchase invoice).</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/app/purchases/bills">Back</Link>
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_320px] xl:items-start">
        <div className="rounded-[28px] border border-border/70 bg-card p-5 shadow-[0_24px_48px_-40px_rgba(91,124,191,0.18)] md:p-7">
          <BillForm
            mode="create"
            tenantId={session.user.tenantId}
            vendors={vendors}
            projects={projects}
            initialValues={{ invoiceDate: today, vendorId: initialVendorId, projectId: initialProjectId }}
            materialReceiptIds={linkedReceipt ? [linkedReceipt.id] : []}
          />
        </div>
        <ModuleCheatSheet
          moduleKey="bills"
          variant="sidebar"
          showRoutingTrigger
          className="order-first xl:order-none xl:sticky xl:top-24"
        />
      </div>
    </div>
  );
}
