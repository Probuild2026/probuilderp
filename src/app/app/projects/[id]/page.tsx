import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { notFound } from "next/navigation";
import { BarChart3, CircleDollarSign, Landmark, MapPin } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

import { PaymentSchedule } from "./payment-schedule";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id, tenantId: session.user.tenantId },
    include: {
      client: { select: { name: true } },
      clientInvoices: { select: { total: true } },
      purchaseInvoices: { select: { total: true } },
      expenses: { select: { totalAmount: true } },
      labourSheets: { select: { total: true } },
    },
  });

  if (!project) return notFound();

  const paymentStages = await prisma.projectPaymentStage.findMany({
    where: { tenantId: session.user.tenantId, projectId: project.id },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      stageName: true,
      scopeOfWork: true,
      percent: true,
      expectedAmount: true,
      expectedBank: true,
      expectedCash: true,
      actualBank: true,
      actualCash: true,
      expectedDate: true,
      actualDate: true,
      notes: true,
      sortOrder: true,
    },
  });

  const receiptRows = await prisma.receipt.groupBy({
    by: ["mode"],
    where: {
      tenantId: session.user.tenantId,
      approvalStatus: { not: "CANCELLED" },
      clientInvoice: {
        is: {
          tenantId: session.user.tenantId,
          projectId: project.id,
        },
      },
    },
    _sum: { amountReceived: true },
  });

  const receiptTotals = receiptRows.reduce(
    (acc, row) => {
      const amount = Number(row._sum.amountReceived ?? 0);
      if (row.mode === "CASH") {
        acc.cash += amount;
      } else {
        acc.bank += amount;
      }
      return acc;
    },
    { bank: 0, cash: 0 },
  );

  const stages = paymentStages.map((s) => ({
    id: s.id,
    stageName: s.stageName,
    scopeOfWork: s.scopeOfWork,
    percent: s.percent ? Number(s.percent) : null,
    expectedAmount: Number(s.expectedAmount),
    expectedBank: Number(s.expectedBank),
    expectedCash: Number(s.expectedCash),
    actualBank: Number(s.actualBank),
    actualCash: Number(s.actualCash),
    expectedDate: s.expectedDate ? s.expectedDate.toISOString().slice(0, 10) : "",
    actualDate: s.actualDate ? s.actualDate.toISOString().slice(0, 10) : "",
    notes: s.notes ?? "",
    sortOrder: s.sortOrder,
  }));

  const expected = stages.reduce((sum, stage) => sum + stage.expectedAmount, 0);
  const received = receiptTotals.bank + receiptTotals.cash;
  const billed = project.clientInvoices.reduce((sum, row) => sum + Number(row.total), 0);
  const spent =
    project.purchaseInvoices.reduce((sum, row) => sum + Number(row.total), 0) +
    project.expenses.reduce((sum, row) => sum + Number(row.totalAmount), 0) +
    project.labourSheets.reduce((sum, row) => sum + Number(row.total), 0);
  const collectionPct = expected > 0 ? Math.max(0, Math.min(100, Math.round((received / expected) * 100))) : 0;
  const spendPct = expected > 0 ? Math.max(0, Math.min(100, Math.round((spent / expected) * 100))) : 0;

  return (
    <div className="mx-auto max-w-[1440px] space-y-6 p-4 md:p-6">
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Projects / Detail</div>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">{project.name}</h1>
              <div className="mt-2 text-sm text-muted-foreground">{project.client.name}</div>
              <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="size-4" />
                {project.location ?? "No location set"}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <Link href="/app/projects">Back</Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader className="border-b border-border/60">
            <CardTitle className="text-base">Project financial summary</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 pt-6 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard icon={Landmark} label="Expected collection" value={formatINR(expected)} />
            <MetricCard icon={CircleDollarSign} label="Received to date" value={formatINR(received)} />
            <MetricCard icon={BarChart3} label="Billed value" value={formatINR(billed)} />
            <MetricCard icon={CircleDollarSign} label="Spent to date" value={formatINR(spent)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border/60">
            <CardTitle className="text-base">Project posture</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <StatRow label="Status" value={project.status} />
            <StatRow label="Schedule rows" value={String(stages.length)} />
            <StatRow label="Collection progress" value={`${collectionPct}%`} />
            <StatRow label="Spend vs expected" value={`${spendPct}%`} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="border-b border-border/60">
          <CardTitle className="text-base">Progress overview</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 pt-6 lg:grid-cols-2">
          <ProgressRail label="Collection progress" value={collectionPct} tint="bg-[var(--success)]" />
          <ProgressRail label="Spend vs expected" value={spendPct} tint="bg-[var(--warning)]" />
        </CardContent>
      </Card>

      <PaymentSchedule projectId={project.id} stages={stages} receiptTotals={receiptTotals} />
    </div>
  );
}

function formatINR(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[22px] border border-border/60 bg-background/70 px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <div className="mt-4 text-2xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[18px] border border-border/60 bg-background/70 px-4 py-3">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}

function ProgressRail({ label, value, tint }: { label: string; value: number; tint: string }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-xs">
        <span className="font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
        <span className="font-semibold">{value}%</span>
      </div>
      <div className="h-2.5 rounded-full bg-muted">
        <div className={`h-full rounded-full ${tint}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
