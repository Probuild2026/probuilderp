import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import Link from "next/link";

import { ModuleCheatSheet } from "@/components/help/module-cheat-sheet";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

import { LabourSheetCreateForm } from "./wages-create-form";

export default async function NewWagesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const projects = await prisma.project.findMany({
    where: { tenantId: session.user.tenantId },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true },
    take: 200,
  });

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">New labour sheet</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Capture direct labour payout lines and generate the linked expense transaction in one pass.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/app/wages">Back</Link>
        </Button>
      </div>

      <section className="grid gap-4 lg:grid-cols-3">
        <MetricCard label="Projects available" value={String(projects.length)} />
        <MetricCard label="Default date" value={today} />
        <MetricCard label="Linked flow" value="Wage sheet + transaction" />
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_360px] xl:items-start">
        <div className="space-y-6">
          <LabourSheetCreateForm today={today} projects={projects} />
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader className="border-b border-border/60">
              <CardTitle className="text-base">Entry guidance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-6 text-sm text-muted-foreground">
              <p>Use this flow for direct labour paid by headcount and daily rate, not vendor subcontractor billing.</p>
              <p>Each save creates the linked cash or bank-side transaction automatically for the selected payment mode.</p>
              <p>Keep roles short and practical so payroll and site reports stay readable.</p>
            </CardContent>
          </Card>
          <ModuleCheatSheet
            moduleKey="wages"
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
      <CardContent className="text-lg font-semibold [overflow-wrap:anywhere]">{value}</CardContent>
    </Card>
  );
}
