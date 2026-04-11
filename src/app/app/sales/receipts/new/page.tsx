import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";

import { ModuleCheatSheet } from "@/components/help/module-cheat-sheet";
import { Button } from "@/components/ui/button";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

import { ReceiptCreateForm } from "./receipt-create-form";

export default async function NewReceiptPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const invoices = await prisma.clientInvoice.findMany({
    where: { tenantId: session.user.tenantId },
    orderBy: [{ invoiceDate: "desc" }, { createdAt: "desc" }],
    take: 300,
    select: {
      id: true,
      invoiceNumber: true,
      invoiceDate: true,
      total: true,
      projectId: true,
      project: { select: { name: true } },
      client: { select: { name: true } },
    },
  });

  const projectIds = Array.from(new Set(invoices.map((i) => i.projectId)));
  const stages = projectIds.length
    ? await prisma.projectPaymentStage.findMany({
        where: { tenantId: session.user.tenantId, projectId: { in: projectIds } },
        orderBy: [{ projectId: "asc" }, { sortOrder: "asc" }],
        select: {
          id: true,
          projectId: true,
          stageName: true,
          expectedBank: true,
          expectedCash: true,
          actualBank: true,
          actualCash: true,
        },
      })
    : [];

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">New receipt</h1>
          <p className="mt-1 text-sm text-muted-foreground">Record money received from a client (including TDS).</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/app/sales/receipts">Back</Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div>
          <ReceiptCreateForm
            today={today}
            invoices={invoices.map((inv) => ({
              id: inv.id,
              invoiceNumber: inv.invoiceNumber,
              projectId: inv.projectId,
              projectName: inv.project.name,
              clientName: inv.client.name,
            }))}
            stages={stages.map((s) => ({
              id: s.id,
              projectId: s.projectId,
              stageName: s.stageName,
              expectedBank: Number(s.expectedBank),
              expectedCash: Number(s.expectedCash),
              actualBank: Number(s.actualBank),
              actualCash: Number(s.actualCash),
            }))}
          />
        </div>
        <ModuleCheatSheet moduleKey="receipts" variant="sidebar" showRoutingTrigger className="order-first lg:order-none" />
      </div>
    </div>
  );
}
