import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";

import { ModuleCheatSheet } from "@/components/help/module-cheat-sheet";
import { Button } from "@/components/ui/button";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

import { BillForm } from "../_components/bill-form";

export default async function NewBillPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

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
      select: { id: true, name: true },
      take: 200,
    }),
  ]);

  const today = new Date().toISOString().slice(0, 10);

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
            initialValues={{ invoiceDate: today }}
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
