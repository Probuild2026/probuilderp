import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { type ApprovalStatus } from "@prisma/client";
import { Pencil } from "lucide-react";

import { ApprovalStatusBadge } from "@/components/app/approval-status-badge";
import { ExportLinks } from "@/components/app/export-links";
import { PageHeader } from "@/components/app/page-header";
import { TableEmptyState } from "@/components/app/state-panels";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { approvalStatusLabels, approvalStatusValues, parseApprovalStatus } from "@/lib/approval-status";
import { getSingleSearchParam } from "@/lib/date-range";
import { formatINR } from "@/lib/money";
import { getSelectedProjectId } from "@/lib/project-filter";
import {
  buildMonthlyOutflowRows,
  isMonthlyOutflowEntryType,
  monthlyOutflowEntryTypeLabels,
  monthlyOutflowEntryTypes,
  type MonthlyOutflowRow,
} from "@/server/exports/module-datasets";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

export default async function MonthlyExpensesReportPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const sp = (await searchParams) ?? {};
  const rawMonth = getSingleSearchParam(sp, "month");
  const month = /^\d{4}-\d{2}$/.test(rawMonth) ? rawMonth : new Date().toISOString().slice(0, 7);
  const q = getSingleSearchParam(sp, "q");
  const approval = parseApprovalStatus(getSingleSearchParam(sp, "approval"));
  const entryTypeRaw = getSingleSearchParam(sp, "entryType");
  const entryType = isMonthlyOutflowEntryType(entryTypeRaw) ? entryTypeRaw : undefined;

  const projectId = await getSelectedProjectId();
  const [project, rows] = await Promise.all([
    projectId
      ? prisma.project.findFirst({
          where: { tenantId: session.user.tenantId, id: projectId },
          select: { name: true },
        })
      : null,
    buildMonthlyOutflowRows({
      tenantId: session.user.tenantId,
      projectId,
      month,
      q,
      approval,
      entryType,
    }),
  ]);

  const totals = rows.reduce(
    (acc, row) => {
      acc.booked += numericValue(row, "totalAmount");
      acc.cash += numericValue(row, "cashAmount");
      acc.tds += numericValue(row, "tdsAmount");
      return acc;
    },
    { booked: 0, cash: 0, tds: 0 },
  );

  const resetHref = `/app/reports/monthly-expenses?month=${encodeURIComponent(month)}`;

  return (
    <div className="w-full space-y-6 p-4 md:p-6">
      <PageHeader
        title="Monthly Outflow Export"
        description="Auditor-friendly monthly outflow register across bills, expenses, wages, and payments made."
        actions={
          <>
            <ExportLinks hrefBase="/api/reports/expenses-csv" params={{ month, q, approval, entryType }} />
            <Button asChild variant="outline">
              <Link href="/app">Back</Link>
            </Button>
          </>
        }
        filters={
          <div className="text-sm text-muted-foreground">
            Project scope: <span className="text-foreground">{project?.name ?? "All projects"}</span>
          </div>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryTile label="Rows in view" value={String(rows.length)} />
        <SummaryTile label="Booked totals" value={formatINR(totals.booked)} />
        <SummaryTile label="Cash paid" value={formatINR(totals.cash)} />
        <SummaryTile label="TDS tracked" value={formatINR(totals.tds)} />
      </section>

      <form
        className="grid gap-3 rounded-[24px] border border-border/70 bg-card px-4 py-4 md:grid-cols-[160px_minmax(220px,1fr)_auto_auto_auto]"
        action="/app/reports/monthly-expenses"
        method="get"
      >
        <label className="space-y-2 text-sm">
          <div className="text-muted-foreground">Month</div>
          <Input type="month" name="month" defaultValue={month} />
        </label>
        <label className="space-y-2 text-sm">
          <div className="text-muted-foreground">Search</div>
          <Input name="q" defaultValue={q} placeholder="Party, project, bill #, reference..." />
        </label>
        <label className="space-y-2 text-sm">
          <div className="text-muted-foreground">Entry type</div>
          <select
            name="entryType"
            defaultValue={entryType ?? ""}
            className="h-10 rounded-xl border border-border/80 bg-background/80 px-3 text-sm shadow-sm"
          >
            <option value="">All entry types</option>
            {monthlyOutflowEntryTypes.map((type) => (
              <option key={type} value={type}>
                {monthlyOutflowEntryTypeLabels[type]}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2 text-sm">
          <div className="text-muted-foreground">Review</div>
          <select
            name="approval"
            defaultValue={approval ?? ""}
            className="h-10 rounded-xl border border-border/80 bg-background/80 px-3 text-sm shadow-sm"
          >
            <option value="">All review statuses</option>
            {approvalStatusValues.map((status) => (
              <option key={status} value={status}>
                {approvalStatusLabels[status]}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-2">
          <Button type="submit">Apply</Button>
          <Button asChild variant="outline">
            <Link href={resetHref}>Reset</Link>
          </Button>
        </div>
      </form>

      <Card>
        <CardHeader className="border-b border-border/60">
          <CardTitle className="text-base">Outflow register</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table className="min-w-[2100px] table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[112px]">Date</TableHead>
                <TableHead className="w-[150px]">Type</TableHead>
                <TableHead className="w-[150px]">Review</TableHead>
                <TableHead className="w-[220px]">Project</TableHead>
                <TableHead className="w-[210px]">Party</TableHead>
                <TableHead className="w-[150px]">Document #</TableHead>
                <TableHead className="w-[160px]">Category</TableHead>
                <TableHead className="w-[128px] text-right">Before Tax</TableHead>
                <TableHead className="w-[112px] text-right">CGST</TableHead>
                <TableHead className="w-[112px] text-right">SGST</TableHead>
                <TableHead className="w-[112px] text-right">IGST</TableHead>
                <TableHead className="w-[128px] text-right">Total</TableHead>
                <TableHead className="w-[128px] text-right">Cash</TableHead>
                <TableHead className="w-[112px] text-right">TDS</TableHead>
                <TableHead className="w-[128px] text-right">Gross</TableHead>
                <TableHead className="w-[128px]">Mode</TableHead>
                <TableHead className="w-[170px]">Reference</TableHead>
                <TableHead className="w-[260px]">Narration</TableHead>
                <TableHead className="w-[108px] text-right">Linked</TableHead>
                <TableHead className="w-[92px] text-right">Edit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableEmptyState
                  colSpan={20}
                  title="No outflows matched this view"
                  description="Try clearing search or widening the entry type and review filters."
                />
              ) : (
                rows.map((row) => (
                  <TableRow key={`${row.entryType}-${row.id}`} className="align-top">
                    <TableCell>{textValue(row, "date")}</TableCell>
                    <TableCell className="whitespace-normal font-medium">{monthlyOutflowEntryTypeLabels[row.entryType]}</TableCell>
                    <TableCell>
                      <ApprovalStatusBadge status={row.values.approvalStatus as ApprovalStatus} />
                    </TableCell>
                    <WrappedCell row={row} field="project" />
                    <WrappedCell row={row} field="party" />
                    <WrappedCell row={row} field="documentNo" />
                    <WrappedCell row={row} field="category" />
                    <MoneyCell row={row} field="amountBeforeTax" />
                    <MoneyCell row={row} field="cgst" />
                    <MoneyCell row={row} field="sgst" />
                    <MoneyCell row={row} field="igst" />
                    <MoneyCell row={row} field="totalAmount" />
                    <MoneyCell row={row} field="cashAmount" />
                    <MoneyCell row={row} field="tdsAmount" />
                    <MoneyCell row={row} field="grossAmount" />
                    <WrappedCell row={row} field="mode" />
                    <WrappedCell row={row} field="reference" />
                    <WrappedCell row={row} field="narration" />
                    <TableCell className="text-right tabular-nums">{textValue(row, "linkedCount")}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="secondary">
                        <Link href={row.editHref}>
                          <Pencil className="size-3.5" />
                          Edit
                        </Link>
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

function numericValue(row: MonthlyOutflowRow, field: string) {
  const value = row.values[field];
  return typeof value === "number" ? value : 0;
}

function textValue(row: MonthlyOutflowRow, field: string) {
  const value = row.values[field];
  return value === null || value === undefined || value === "" ? "-" : String(value);
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-[22px] border border-border/60 bg-background/70 px-4 py-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className="mt-4 min-w-0 text-xl font-semibold leading-tight tracking-tight [overflow-wrap:anywhere] sm:text-2xl">
        {value}
      </div>
    </div>
  );
}

function MoneyCell({ row, field }: { row: MonthlyOutflowRow; field: string }) {
  const value = row.values[field];
  return <TableCell className="text-right tabular-nums">{typeof value === "number" ? formatINR(value) : "-"}</TableCell>;
}

function WrappedCell({ row, field }: { row: MonthlyOutflowRow; field: string }) {
  return (
    <TableCell className="whitespace-normal break-words leading-6">
      <div className="line-clamp-3">{textValue(row, field)}</div>
    </TableCell>
  );
}
