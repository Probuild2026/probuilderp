import Link from "next/link";
import { getServerSession } from "next-auth/next";

import { ModuleCheatSheet } from "@/components/help/module-cheat-sheet";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">New expense</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Capture site spend, attach bills, and keep the expense ledger aligned with project activity.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/app/expenses">Back</Link>
        </Button>
      </div>

      <section className="grid gap-4 lg:grid-cols-3">
        <MetricCard label="Projects available" value={String(projects.length)} />
        <MetricCard label="Vendor master" value={String(vendors.length)} />
        <MetricCard label="Labour master" value={String(labourers.length)} />
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_360px] xl:items-start">
        <div className="space-y-6">
          <ExpenseCreateForm
            tenantId={session.user.tenantId}
            today={today}
            projects={projects}
            vendors={vendors}
            labourers={labourers}
          />
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader className="border-b border-border/60">
              <CardTitle className="text-base">Entry guidance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-6 text-sm text-muted-foreground">
              <p>Use Expenses for direct site spend and operational outflows that do not belong in a vendor bill workflow.</p>
              <p>Add a payment mode only when the cash movement is already settled. Leave it blank if the spend is recorded first and paid later.</p>
              <p>Attach the bill here when you want audit-friendly backup on the expense itself.</p>
            </CardContent>
          </Card>
          <ModuleCheatSheet
            moduleKey="expenses"
            variant="sidebar"
            showDecisionHints
            showRoutingTrigger
          />
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="text-lg font-semibold">{value}</CardContent>
    </Card>
  );
}
