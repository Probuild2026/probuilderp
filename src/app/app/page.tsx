import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { AlertTriangle, ArrowRight, BriefcaseBusiness, CircleDollarSign, Clock3, FileWarning, HandCoins, Landmark, Plus, ReceiptText, WalletCards } from "lucide-react";
import { Prisma } from "@prisma/client";
import type { ComponentType } from "react";

import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function formatINR(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

function formatCompactINR(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}

function isDbUnavailable(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (error instanceof Prisma.PrismaClientKnownRequestError) return error.code === "P1001" || error.code === "P1002";
  return message.includes("Can't reach database server") || message.includes("P1001");
}

function pct(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((value / total) * 100)));
}

type ProjectHealthRow = {
  id: string;
  name: string;
  status: string;
  clientName: string;
  expected: number;
  received: number;
  billed: number;
  spent: number;
};

export default async function AppHomePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const today = new Date();
  const from = startOfMonth(today);

  let dbUnavailable = false;
  let metrics = {
    cashInMonth: 0,
    billValueMonth: 0,
    paymentsMadeMonth: 0,
    expensesMonth: 0,
    wagesMonth: 0,
    receivablesOutstanding: 0,
    payablesOutstanding: 0,
    overdueBills: 0,
    unpaidInvoices: 0,
    pendingWages: 0,
    activeProjects: 0,
    totalProjects: 0,
  };
  let projectHealth: ProjectHealthRow[] = [];
  let recentInvoices: Array<{
    id: string;
    invoiceNumber: string;
    clientName: string;
    total: number;
    outstanding: number;
    dueDate: Date | null;
  }> = [];

  try {
    const [
      receiptsAgg,
      billsAgg,
      vendorPaymentsAgg,
      expensesAgg,
      wagesAgg,
      totalProjects,
      activeProjects,
      invoiceRows,
      billRows,
      projectRows,
      stageRows,
      receiptAllocations,
      purchaseAllocations,
    ] = await Promise.all([
      prisma.receipt.aggregate({
        where: { tenantId: session.user.tenantId, date: { gte: from, lte: today } },
        _sum: { amountReceived: true },
      }),
      prisma.purchaseInvoice.aggregate({
        where: { tenantId: session.user.tenantId, invoiceDate: { gte: from, lte: today } },
        _sum: { total: true },
      }),
      prisma.vendorPayment.aggregate({
        where: { tenantId: session.user.tenantId, date: { gte: from, lte: today } },
        _sum: { amountPaid: true, tdsAmount: true },
      }),
      prisma.expense.aggregate({
        where: { tenantId: session.user.tenantId, date: { gte: from, lte: today } },
        _sum: { totalAmount: true },
      }),
      prisma.labourSheet.aggregate({
        where: { tenantId: session.user.tenantId, date: { gte: from, lte: today } },
        _sum: { total: true },
      }),
      prisma.project.count({
        where: { tenantId: session.user.tenantId },
      }),
      prisma.project.count({
        where: { tenantId: session.user.tenantId, status: "ACTIVE" },
      }),
      prisma.clientInvoice.findMany({
        where: { tenantId: session.user.tenantId },
        orderBy: [{ invoiceDate: "desc" }, { createdAt: "desc" }],
        take: 300,
        select: {
          id: true,
          invoiceNumber: true,
          dueDate: true,
          total: true,
          projectId: true,
          client: { select: { name: true } },
        },
      }),
      prisma.purchaseInvoice.findMany({
        where: { tenantId: session.user.tenantId },
        orderBy: [{ invoiceDate: "desc" }, { createdAt: "desc" }],
        take: 300,
        select: {
          id: true,
          invoiceNumber: true,
          invoiceDate: true,
          total: true,
          vendor: { select: { name: true } },
        },
      }),
      prisma.project.findMany({
        where: { tenantId: session.user.tenantId },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        take: 18,
        select: {
          id: true,
          name: true,
          status: true,
          client: { select: { name: true } },
          clientInvoices: { select: { id: true, total: true } },
          purchaseInvoices: { select: { id: true, total: true } },
          expenses: { select: { totalAmount: true } },
          labourSheets: { select: { total: true } },
        },
      }),
      prisma.projectPaymentStage.findMany({
        where: { tenantId: session.user.tenantId },
        select: { projectId: true, expectedAmount: true, actualBank: true, actualCash: true },
      }),
      prisma.transactionAllocation.groupBy({
        by: ["documentId"],
        where: { tenantId: session.user.tenantId, documentType: "CLIENT_INVOICE" },
        _sum: { grossAmount: true },
      }),
      prisma.transactionAllocation.groupBy({
        by: ["documentId"],
        where: { tenantId: session.user.tenantId, documentType: "PURCHASE_INVOICE" },
        _sum: { grossAmount: true },
      }),
    ]);

    const receiptMap = new Map(receiptAllocations.map((row) => [row.documentId, Number(row._sum.grossAmount ?? 0)]));
    const purchaseMap = new Map(purchaseAllocations.map((row) => [row.documentId, Number(row._sum.grossAmount ?? 0)]));
    const stageMap = new Map<string, { expected: number; received: number }>();

    for (const stage of stageRows) {
      const current = stageMap.get(stage.projectId) ?? { expected: 0, received: 0 };
      current.expected += Number(stage.expectedAmount);
      current.received += Number(stage.actualBank) + Number(stage.actualCash);
      stageMap.set(stage.projectId, current);
    }

    const receivablesOutstanding = invoiceRows.reduce((sum, row) => {
      return sum + Math.max(0, Number(row.total) - (receiptMap.get(row.id) ?? 0));
    }, 0);
    const payablesOutstanding = billRows.reduce((sum, row) => {
      return sum + Math.max(0, Number(row.total) - (purchaseMap.get(row.id) ?? 0));
    }, 0);
    const overdueBills = billRows.filter((row) => Math.max(0, Number(row.total) - (purchaseMap.get(row.id) ?? 0)) > 1 && row.invoiceDate < today).length;
    const unpaidInvoices = invoiceRows.filter((row) => Math.max(0, Number(row.total) - (receiptMap.get(row.id) ?? 0)) > 1).length;
    const pendingWages = Number(wagesAgg._sum.total ?? 0);

    projectHealth = projectRows.map((project) => {
      const stage = stageMap.get(project.id) ?? { expected: 0, received: 0 };
      const billed = project.clientInvoices.reduce((sum, row) => sum + Number(row.total), 0);
      const spent =
        project.purchaseInvoices.reduce((sum, row) => sum + Number(row.total), 0) +
        project.expenses.reduce((sum, row) => sum + Number(row.totalAmount), 0) +
        project.labourSheets.reduce((sum, row) => sum + Number(row.total), 0);

      return {
        id: project.id,
        name: project.name,
        status: project.status,
        clientName: project.client.name,
        expected: stage.expected,
        received: stage.received,
        billed,
        spent,
      };
    });

    recentInvoices = invoiceRows
      .map((invoice) => ({
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        clientName: invoice.client.name,
        total: Number(invoice.total),
        outstanding: Math.max(0, Number(invoice.total) - (receiptMap.get(invoice.id) ?? 0)),
        dueDate: invoice.dueDate,
      }))
      .filter((invoice) => invoice.outstanding > 1)
      .slice(0, 6);

    metrics = {
      cashInMonth: Number(receiptsAgg._sum.amountReceived ?? 0),
      billValueMonth: Number(billsAgg._sum.total ?? 0),
      paymentsMadeMonth: Number(vendorPaymentsAgg._sum.amountPaid ?? 0) + Number(vendorPaymentsAgg._sum.tdsAmount ?? 0),
      expensesMonth: Number(expensesAgg._sum.totalAmount ?? 0),
      wagesMonth: Number(wagesAgg._sum.total ?? 0),
      receivablesOutstanding,
      payablesOutstanding,
      overdueBills,
      unpaidInvoices,
      pendingWages,
      activeProjects,
      totalProjects,
    };
  } catch (e) {
    if (isDbUnavailable(e)) {
      dbUnavailable = true;
    } else {
      throw e;
    }
  }

  const cashOutMonth = metrics.paymentsMadeMonth + metrics.expensesMonth + metrics.wagesMonth;
  const netMovement = metrics.cashInMonth - cashOutMonth;
  const attentionItems = [
    { label: "Bills overdue", value: String(metrics.overdueBills), href: "/app/purchases/bills", tone: metrics.overdueBills > 0 ? "danger" : "neutral" },
    { label: "Invoices awaiting collection", value: String(metrics.unpaidInvoices), href: "/app/sales/invoices", tone: metrics.unpaidInvoices > 0 ? "warning" : "neutral" },
    { label: "Payables outstanding", value: formatCompactINR(metrics.payablesOutstanding), href: "/app/purchases/payments-made", tone: metrics.payablesOutstanding > 0 ? "warning" : "neutral" },
    { label: "Receivables outstanding", value: formatCompactINR(metrics.receivablesOutstanding), href: "/app/sales/receipts", tone: metrics.receivablesOutstanding > 0 ? "info" : "neutral" },
  ] as const;

  return (
    <div className="mx-auto max-w-[1440px] space-y-6 p-4 md:p-6">
      <PageHeader
        eyebrow="Overview"
        title="Construction finance command center"
        description="Use the dashboard to watch cash movement, collection pressure, payables exposure, and site-level financial progress without dropping into raw tables first."
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="lg">
                <Plus className="size-4" />
                Quick add
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href="/app/purchases/bills/new">New bill</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/app/purchases/payments-made/new">New vendor payment</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/app/sales/invoices/new">New invoice</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/app/sales/receipts/new">New receipt</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/app/expenses/new">New expense</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/app/transactions/new">New transaction</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      {dbUnavailable ? (
        <div className="rounded-[24px] border border-amber-500/30 bg-amber-500/10 px-4 py-4 text-sm text-amber-900 dark:text-amber-200">
          Database temporarily unreachable. The shell remains available, but live operational totals are hidden until connectivity returns.
        </div>
      ) : null}

      <section className="grid gap-3 lg:grid-cols-4">
        {attentionItems.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="rounded-[24px] border border-border/70 bg-card px-4 py-4 shadow-[0_18px_60px_-52px_rgba(30,24,18,0.7)] transition-transform hover:-translate-y-0.5"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{item.label}</div>
                <div className="mt-3 text-2xl font-semibold tracking-tight">{item.value}</div>
              </div>
              <Badge
                variant={
                  item.tone === "danger"
                    ? "destructive"
                    : item.tone === "warning"
                      ? "secondary"
                      : item.tone === "info"
                        ? "default"
                        : "outline"
                }
              >
                Watch
              </Badge>
            </div>
          </Link>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.55fr_1fr]">
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border/60">
            <CardTitle className="text-base">Cash snapshot</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 pt-6 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard icon={HandCoins} label="Cash in this month" value={formatINR(metrics.cashInMonth)} tone="success" />
            <MetricCard icon={WalletCards} label="Cash out this month" value={formatINR(cashOutMonth)} tone="warning" />
            <MetricCard icon={CircleDollarSign} label="Net movement" value={formatINR(netMovement)} tone={netMovement >= 0 ? "success" : "danger"} />
            <MetricCard icon={Landmark} label="Outstanding receivables" value={formatINR(metrics.receivablesOutstanding)} tone="info" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border/60">
            <CardTitle className="text-base">Operational pulse</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <PulseRow label="Active projects" value={`${metrics.activeProjects}/${metrics.totalProjects}`} />
            <PulseRow label="Outstanding payables" value={formatCompactINR(metrics.payablesOutstanding)} />
            <PulseRow label="Pending wages" value={formatCompactINR(metrics.pendingWages)} />
            <PulseRow label="Monthly bill intake" value={formatCompactINR(metrics.billValueMonth)} />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader className="border-b border-border/60">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base">Project health</CardTitle>
              <Button asChild variant="outline" size="sm">
                <Link href="/app/projects">All projects</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 pt-6">
            {projectHealth.length === 0 ? (
              <EmptyMessage message="Projects will appear here once live project, billing, and spending data is available." />
            ) : (
              projectHealth.slice(0, 6).map((project) => {
                const collectionPct = pct(project.received, Math.max(project.expected, project.billed, 1));
                const spendPct = pct(project.spent, Math.max(project.expected, project.billed, 1));
                return (
                  <Link
                    key={project.id}
                    href={`/app/projects/${project.id}`}
                    className="block rounded-[22px] border border-border/60 bg-background/70 px-4 py-4 transition-colors hover:bg-muted/25"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="truncate text-base font-semibold">{project.name}</div>
                          <Badge variant="outline">{project.status}</Badge>
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">{project.clientName}</div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
                        <Stat label="Expected" value={formatCompactINR(project.expected)} />
                        <Stat label="Received" value={formatCompactINR(project.received)} />
                        <Stat label="Billed" value={formatCompactINR(project.billed)} />
                        <Stat label="Spent" value={formatCompactINR(project.spent)} />
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <ProgressRail label="Collection progress" value={collectionPct} tint="bg-[var(--success)]" />
                      <ProgressRail label="Spend vs plan" value={spendPct} tint="bg-[var(--warning)]" />
                    </div>
                  </Link>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border/60">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base">Collection work queue</CardTitle>
              <Button asChild variant="outline" size="sm">
                <Link href="/app/sales/invoices">Open invoices</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {recentInvoices.length === 0 ? (
              <EmptyMessage message="No unsettled invoices are currently waiting for collection follow-up." />
            ) : (
              <div className="space-y-3">
                {recentInvoices.map((invoice) => (
                  <Link
                    key={invoice.id}
                    href={`/app/sales/invoices/${invoice.id}`}
                    className="flex items-start justify-between gap-4 rounded-[20px] border border-border/60 bg-background/75 px-4 py-4 transition-colors hover:bg-muted/25"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{invoice.invoiceNumber}</div>
                      <div className="mt-1 truncate text-sm text-muted-foreground">{invoice.clientName}</div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Clock3 className="size-3.5" />
                        Due {invoice.dueDate ? invoice.dueDate.toISOString().slice(0, 10) : "not set"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground">Outstanding</div>
                      <div className="mt-1 text-base font-semibold">{formatCompactINR(invoice.outstanding)}</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader className="border-b border-border/60">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base">Finance queue</CardTitle>
              <Button asChild variant="outline" size="sm">
                <Link href="/app/purchases/bills">Bills</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Queue item</TableHead>
                  <TableHead>Count / value</TableHead>
                  <TableHead>Route</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <QueueRow icon={FileWarning} title="Overdue vendor bills" value={`${metrics.overdueBills} items`} href="/app/purchases/bills" />
                <QueueRow icon={ReceiptText} title="Receivables awaiting follow-up" value={`${metrics.unpaidInvoices} invoices`} href="/app/sales/invoices" />
                <QueueRow icon={AlertTriangle} title="Outstanding payables exposure" value={formatINR(metrics.payablesOutstanding)} href="/app/purchases/payments-made" />
                <QueueRow icon={BriefcaseBusiness} title="Current wage run" value={formatINR(metrics.pendingWages)} href="/app/wages" />
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border/60">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base">Fast paths</CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link href="/app/reports">
                  Reports
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 pt-6">
            <Shortcut href="/app/purchases/bills/new" label="Create bill" meta="Capture vendor invoice and payable." />
            <Shortcut href="/app/sales/receipts/new" label="Record receipt" meta="Allocate cash and TDS against invoices." />
            <Shortcut href="/app/expenses/new" label="Log expense" meta="Push direct operating costs into reporting." />
            <Shortcut href="/app/transactions/new" label="Add transaction" meta="Capture cashbook movement and transfers." />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone: "success" | "warning" | "danger" | "info";
}) {
  const toneClasses = {
    success: "bg-[color-mix(in_srgb,var(--success)_12%,transparent)] text-[var(--success)]",
    warning: "bg-[color-mix(in_srgb,var(--warning)_12%,transparent)] text-[var(--warning)]",
    danger: "bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] text-[var(--danger)]",
    info: "bg-[color-mix(in_srgb,var(--info)_12%,transparent)] text-[var(--info)]",
  }[tone];

  return (
    <div className="rounded-[22px] border border-border/60 bg-background/70 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
        <div className={`flex size-10 items-center justify-center rounded-2xl ${toneClasses}`}>
          <Icon className="size-4" />
        </div>
      </div>
      <div className="mt-5 text-2xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}

function PulseRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[18px] border border-border/60 bg-background/70 px-4 py-3">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className="mt-1 font-semibold">{value}</div>
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

function QueueRow({
  icon: Icon,
  title,
  value,
  href,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  value: string;
  href: string;
}) {
  return (
    <TableRow>
      <TableCell>
        <Link href={href} className="flex items-center gap-3 font-medium">
          <span className="flex size-9 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <Icon className="size-4" />
          </span>
          <span>{title}</span>
        </Link>
      </TableCell>
      <TableCell>{value}</TableCell>
      <TableCell>
        <Button asChild size="sm" variant="outline">
          <Link href={href}>Open</Link>
        </Button>
      </TableCell>
    </TableRow>
  );
}

function Shortcut({ href, label, meta }: { href: string; label: string; meta: string }) {
  return (
    <Link href={href} className="rounded-[20px] border border-border/60 bg-background/75 px-4 py-4 transition-colors hover:bg-muted/25">
      <div className="font-semibold">{label}</div>
      <div className="mt-1 text-sm text-muted-foreground">{meta}</div>
    </Link>
  );
}

function EmptyMessage({ message }: { message: string }) {
  return <div className="rounded-[22px] border border-dashed border-border/80 bg-background/60 px-4 py-8 text-center text-sm text-muted-foreground">{message}</div>;
}
