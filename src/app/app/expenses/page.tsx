import Link from "next/link";
import { getServerSession } from "next-auth/next";

import { ApprovalStatusBadge } from "@/components/app/approval-status-badge";
import { ApprovalStatusGuide } from "@/components/app/approval-status-guide";
import { ExportLinks } from "@/components/app/export-links";
import { PageHeader } from "@/components/app/page-header";
import { EntryRoutingHelpModal } from "@/components/help/entry-routing-help-modal";
import { ModuleCheatSheet } from "@/components/help/module-cheat-sheet";
import { Button } from "@/components/ui/button";
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
    orderBy: { date: "desc" },
    take: 100,
  });

  const attachmentCounts = await prisma.attachment.groupBy({
    by: ["entityId"],
    where: { tenantId: session.user.tenantId, entityType: "EXPENSE", entityId: { in: expenses.map((e) => e.id) } },
    _count: { _all: true },
  });
  const attachmentCountByExpense = new Map(attachmentCounts.map((a) => [a.entityId, a._count._all]));

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <PageHeader
        title="Expenses"
        description="Daily expenses, labour, overheads."
        action={{ label: "New Expense", href: "/app/expenses/new" }}
        actions={<ExportLinks hrefBase="/api/exports/expenses" params={{ q, from, to, approval }} />}
        actionSecondary={<EntryRoutingHelpModal />}
      />

      <ModuleCheatSheet moduleKey="expenses" variant="compact" showDecisionHints />

      <form className="flex flex-wrap gap-3" action="/app/expenses" method="get">
        <Input name="q" placeholder="Search narration/vendor/project..." defaultValue={q} className="max-w-sm" />
        <select
          name="approval"
          defaultValue={approval ?? ""}
          className="h-10 rounded-md border bg-background px-3 text-sm"
        >
          <option value="">All review statuses</option>
          {approvalStatusValues.map((status) => (
            <option key={status} value={status}>
              {approvalStatusLabels[status]}
            </option>
          ))}
        </select>
        <Input name="from" type="date" defaultValue={from} />
        <Input name="to" type="date" defaultValue={to} />
        <button className="h-10 rounded-md bg-primary px-4 text-sm text-primary-foreground" type="submit">
          Apply
        </button>
        <Link className="h-10 rounded-md border px-4 text-sm leading-10" href="/app/expenses">
          Reset
        </Link>
      </form>

      <ApprovalStatusGuide />

      <div className="overflow-x-auto rounded-md border">
        <Table className="w-full table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[90px]">Date</TableHead>
            <TableHead className="w-[130px]">Project</TableHead>
            <TableHead className="w-[150px]">Vendor/Labour</TableHead>
            <TableHead className="w-[110px]">Type</TableHead>
            <TableHead>Narration</TableHead>
            <TableHead className="w-[100px] text-right">Total</TableHead>
            <TableHead className="w-[100px]">Paid via</TableHead>
            <TableHead className="w-[140px]">Review</TableHead>
            <TableHead className="w-[50px]">Bills</TableHead>
            <TableHead className="w-[70px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {expenses.map((e) => (
            <TableRow key={e.id}>
              <TableCell className="align-top">{e.date.toISOString().slice(0, 10)}</TableCell>
              <TableCell className="align-top truncate">{e.project.name}</TableCell>
              <TableCell className="align-top truncate">{e.vendor?.name ?? e.labourer?.name ?? "-"}</TableCell>
              <TableCell className="align-top">{e.expenseType}</TableCell>
              <TableCell className="align-top whitespace-normal break-words">{e.narration ?? "—"}</TableCell>
              <TableCell className="align-top text-right tabular-nums">{formatINR(Number(e.totalAmount))}</TableCell>
              <TableCell>{e.paymentMode ?? "-"}</TableCell>
              <TableCell><ApprovalStatusBadge status={e.approvalStatus} /></TableCell>
              <TableCell>{attachmentCountByExpense.get(e.id) ?? 0}</TableCell>
              <TableCell className="text-right">
                <Button asChild size="sm" variant="outline">
                  <Link href={`/app/expenses/${e.id}`}>View</Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {expenses.length === 0 ? (
            <TableRow>
              <TableCell colSpan={10} className="py-10 text-center text-sm text-muted-foreground">
                No expenses yet.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
        </Table>
      </div>
    </div>
  );
}
