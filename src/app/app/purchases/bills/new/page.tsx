import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";

import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

import { PurchaseInvoiceCreateForm } from "./purchase-invoice-create-form";

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
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold">New Bill</h1>
        <p className="mt-1 text-sm text-muted-foreground">Record a vendor bill (purchase invoice).</p>
      </div>
      <PurchaseInvoiceCreateForm today={today} projects={projects} vendors={vendors} />
    </div>
  );
}

