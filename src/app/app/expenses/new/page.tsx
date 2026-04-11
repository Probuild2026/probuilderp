import Link from "next/link";
import { getServerSession } from "next-auth/next";

import { ModuleCheatSheet } from "@/components/help/module-cheat-sheet";
import { Button } from "@/components/ui/button";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

import { ExpenseCreateForm } from "./expense-create-form";

export default async function NewExpensePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const [projects, vendors, labourers] = await Promise.all([
    prisma.project.findMany({
      where: { tenantId: session.user.tenantId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.vendor.findMany({
      where: { tenantId: session.user.tenantId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.labourer.findMany({
      where: { tenantId: session.user.tenantId, active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">New Expense</h1>
          <p className="mt-1 text-sm text-muted-foreground">Daily expenses with optional bill upload.</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/app/expenses">Back</Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div>
          <ExpenseCreateForm
            tenantId={session.user.tenantId}
            today={today}
            projects={projects}
            vendors={vendors}
            labourers={labourers}
          />
        </div>
        <ModuleCheatSheet
          moduleKey="expenses"
          variant="sidebar"
          showDecisionHints
          showRoutingTrigger
          className="order-first lg:order-none"
        />
      </div>
    </div>
  );
}
