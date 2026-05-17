import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";

import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

import { PurchaseOrderForm } from "./purchase-order-form";

export default async function NewPurchaseOrderPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const [vendors, projects] = await Promise.all([
    prisma.vendor.findMany({
      where: { tenantId: session.user.tenantId, active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
      take: 500,
    }),
    prisma.project.findMany({
      where: { tenantId: session.user.tenantId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
      take: 500,
    }),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      <div>
        <p className="text-sm text-muted-foreground">Purchases / Purchase Orders</p>
        <h1 className="mt-1 text-2xl font-semibold">New Purchase Order</h1>
      </div>
      <PurchaseOrderForm vendors={vendors} projects={projects} />
    </div>
  );
}
