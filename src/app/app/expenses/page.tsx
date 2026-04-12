import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { CreditCard, FileText, ReceiptIndianRupee, UserRound } from "lucide-react";

import { ApprovalStatusBadge } from "@/components/app/approval-status-badge";
import { ApprovalStatusGuide } from "@/components/app/approval-status-guide";
import { ExportLinks } from "@/components/app/export-links";
import { PageHeader } from "@/components/app/page-header";
import { EntryRoutingHelpModal } from "@/components/help/entry-routing-help-modal";
import { ModuleCheatSheet } from "@/components/help/module-cheat-sheet";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { approvalStatusLabels, approvalStatusValues, parseApprovalStatus } from "@/lib/approval-status";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { buildInclusiveDateRange, getSingleSearchParam, parseDateRangeParams } from "@/lib/date-range";
import { formatINR } from "@/lib/money";
import { getSelectedProjectId } from "@/lib/project-filter";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const sp = (await searchParams) ?? {};
  const q = getSingleSearchParam(sp, "q");
  const approval = parseApprovalStatus(getSingleSearchParam(sp, "approval"));
  const { from, to } = parseDateRangeParams(sp);
  const dateRange = buildInclusiveDateRange(from, to);
  const projectId = await getSelectedProjectId();

  const expenses = await prisma.expense.findMany({
    where: {
      tenantId: session.user.tenantId,
      ...(projectId ? { projectId } : {}),
      ...(dateRange ? { date: dateRange } : {}),
      ...(approval ? { approvalStatus: approval } : {}),
      ...(q
        ? {
            OR: [
              { narration: { contains: q, mode: "insensitive" } },
              { vendor: { name: { contains: q, mode: "insensitive" } } },
              { project: { name: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    include: {
      project: { select: { id: true, name: true } },
      vendor: { select: { id: true, name: true } },
      labourer: { select: { id: true, name: true } },
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 100,
  });

  const attachmentCounts = await prisma.attachment.groupBy({
    by: ["entityId"],
    where: { tenantId: session.user.tenantId, entityType: "EXPENSE", entityId: { in: expenses.map((expense) => expense.id) } },
    _count: { _all: true },
  });
  const attachmentCountByExpense = new Map(attachmentCounts.map((row) => [row.entityId, row._count._all]));

  const totals = expenses.reduce(
    (acc, expense) => {
      acc.total += Number(expense.totalAmount);
      acc.attachments += attachmentCountByExpense.get(expense.id) ?? 0;
      if (expense.vendorId) acc.vendorBacked += 1;
      if (expense.labourerId) acc.labourBacked += 1;
      return acc;
    },
    { total: 0, attachments: 0, vendorBacked: 0, labourBacked: 0 },
  );

  return (
    <div className="mx-auto max-w-[1440px] space-y-6 p-4 md:p-6">
      <PageHeader
        eyebrow="Finance / Expenses"
        title="Expenses"
        description="Review direct operating costs, who they were paid to, and whether the supporting documentation is complete before drilling into the entry."
        action={{ label: "New expense", href: "/app/expenses/new" }}
        actions={<ExportLinks hrefBase="/api/exports/expenses" params={{ q, from, to, approval }} />}
        actionSecondary={<EntryRoutingHelpModal />}
      />

      <ModuleCheatSheet moduleKey="expenses" variant="compact" showDecisionHints />

      <section className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader className="border-b border-border/60">
            <CardTitle className="text-base">Expense summary</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 pt-6 md:grid-cols-2 xl:grid-cols-4">
            <SummaryTile icon={ReceiptIndianRupee} label="Expense value" value={formatINR(totals.total)} />
            <SummaryTile icon={FileText} label="Attached documents" value={String(totals.attachments)} />
            <SummaryTile icon={CreditCard} label="Vendor-backed entries" value={String(totals.vendorBacked)} />
            <SummaryTile icon={UserRound} label="Labour-backed entries" value={String(totals.labourBacked)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border/60">
            <CardTitle className="text-base">Filters and review</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-6">
            <QueuePill label="Entries in current view" value={String(expenses.length)} />
            <QueuePill label="Exports ready" value="CSV / Excel / PDF" />
            <QueuePill label="Review statuses" value="Draft / Pending / Approved" />
          </CardContent>
        </Card>
      </section>

      <form className="flex flex-wrap gap-3 rounded-[24px] border border-border/70 bg-card px-4 py-4" action="/app/expenses" method="get">
        <Input name="q" placeholder="Search narration, vendor, project..." defaultValue={q} className="max-w-sm" />
        <select name="approval" defaultValue={approval ?? ""} className="h-10 rounded-xl border border-border/80 bg-background/80 px-3 text-sm shadow-sm">
          <option value="">All review statuses</option>
          {approvalStatusValues.map((status) => (
            <option key={status} value={status}>
              {approvalStatusLabels[status]}
            </option>
          ))}
        </select>
        <Input name="from" type="date" defaultValue={from} />
        <Input name="to" type="date" defaultValue={to} />
        <button className="h-10 rounded-xl bg-primary px-4 text-sm text-primary-foreground" type="submit">
          Apply
        </button>
        <Link className="h-10 rounded-xl border border-border/80 px-4 text-sm leading-10" href="/app/expenses">
          Reset
        </Link>
      </form>

      <ApprovalStatusGuide />

      <Card>
        <CardHeader className="border-b border-border/60">
          <CardTitle className="text-base">Expense ledger</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table className="w-full table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Date</TableHead>
                <TableHead className="w-[150px]">Project</TableHead>
                <TableHead className="w-[170px]">Vendor / Labour</TableHead>
                <TableHead className="w-[120px]">Type</TableHead>
                <TableHead>Narration</TableHead>
                <TableHead className="w-[110px] text-right">Total</TableHead>
                <TableHead className="w-[110px]">Paid via</TableHead>
                <TableHead className="w-[140px]">Review</TableHead>
                <TableHead className="w-[72px] text-right">Docs</TableHead>
                <TableHead className="w-[84px] text-right">Open</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="py-12 text-center text-sm text-muted-foreground">
                    No expenses matched this view.
                  </TableCell>
                </TableRow>
              ) : (
                expenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell>{expense.date.toISOString().slice(0, 10)}</TableCell>
                    <TableCell className="truncate">{expense.project.name}</TableCell>
                    <TableCell className="truncate">{expense.vendor?.name ?? expense.labourer?.name ?? "-"}</TableCell>
                    <TableCell>{expense.expenseType}</TableCell>
                    <TableCell className="whitespace-normal break-words">{expense.narration ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatINR(Number(expense.totalAmount))}</TableCell>
                    <TableCell>{expense.paymentMode ?? "-"}</TableCell>
                    <TableCell><ApprovalStatusBadge status={expense.approvalStatus} /></TableCell>
                    <TableCell className="text-right">{attachmentCountByExpense.get(expense.id) ?? 0}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/app/expenses/${expense.id}`}>View</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryTile({
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

function QueuePill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[18px] border border-border/60 bg-background/70 px-4 py-3">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}
