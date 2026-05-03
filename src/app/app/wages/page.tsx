import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { BriefcaseBusiness, FileSpreadsheet, ShieldCheck, Wallet } from "lucide-react";

import { ApprovalStatusBadge } from "@/components/app/approval-status-badge";
import { ApprovalStatusGuide } from "@/components/app/approval-status-guide";
import { ExportLinks } from "@/components/app/export-links";
import { PageHeader } from "@/components/app/page-header";
import { TableEmptyState } from "@/components/app/state-panels";
import { EntryRoutingHelpModal } from "@/components/help/entry-routing-help-modal";
import { ModuleCheatSheet } from "@/components/help/module-cheat-sheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { approvalStatusLabels, approvalStatusValues, parseApprovalStatus } from "@/lib/approval-status";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { buildInclusiveDateRange, getSingleSearchParam, parseDateRangeParams } from "@/lib/date-range";
import { formatINR } from "@/lib/money";
import { getSelectedProjectId } from "@/lib/project-filter";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

export default async function WagesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const sp = (await searchParams) ?? {};
  const approval = parseApprovalStatus(getSingleSearchParam(sp, "approval"));
  const { from, to } = parseDateRangeParams(sp);
  const dateRange = buildInclusiveDateRange(from, to);
  const projectId = await getSelectedProjectId();

  const sheets = await prisma.labourSheet.findMany({
    where: {
      tenantId: session.user.tenantId,
      ...(projectId ? { projectId } : {}),
      ...(dateRange ? { date: dateRange } : {}),
      ...(approval ? { approvalStatus: approval } : {}),
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 200,
    select: {
      id: true,
      date: true,
      total: true,
      mode: true,
      reference: true,
      approvalStatus: true,
      project: { select: { id: true, name: true } },
    },
  });

  const sheetIds = sheets.map((sheet) => sheet.id);
  const lineCountBySheetId = new Map<string, number>();
  if (sheetIds.length > 0) {
    const lines = await prisma.labourSheetLine.findMany({
      where: { tenantId: session.user.tenantId, labourSheetId: { in: sheetIds } },
      select: { labourSheetId: true },
    });
    for (const line of lines) {
      lineCountBySheetId.set(line.labourSheetId, (lineCountBySheetId.get(line.labourSheetId) ?? 0) + 1);
    }
  }

  const totals = sheets.reduce(
    (acc, sheet) => {
      acc.total += Number(sheet.total);
      acc.lines += lineCountBySheetId.get(sheet.id) ?? 0;
      if (sheet.approvalStatus === "PENDING_APPROVAL") acc.pendingApproval += 1;
      return acc;
    },
    { total: 0, lines: 0, pendingApproval: 0 },
  );

  return (
    <div className="w-full space-y-6 p-4 md:p-6">
      <PageHeader
        eyebrow="Workforce / Wages"
        title="Wages"
        description="Track labour-sheet payouts, how many worker lines sit inside each sheet, and which wage runs still need review."
        action={{ label: "New labour sheet", href: "/app/wages/new" }}
        actions={<ExportLinks hrefBase="/api/exports/wages" params={{ from, to, approval }} />}
        actionSecondary={<EntryRoutingHelpModal />}
      />

      <ModuleCheatSheet moduleKey="wages" variant="compact" showDecisionHints />

      <section className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader className="border-b border-border/60">
            <CardTitle className="text-base">Wage summary</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 pt-6 sm:grid-cols-2 2xl:grid-cols-4">
            <SummaryTile icon={Wallet} label="Wage value" value={formatINR(totals.total)} />
            <SummaryTile icon={FileSpreadsheet} label="Worker lines" value={String(totals.lines)} />
            <SummaryTile icon={ShieldCheck} label="Pending approval" value={String(totals.pendingApproval)} />
            <SummaryTile icon={BriefcaseBusiness} label="Labour sheets" value={String(sheets.length)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border/60">
            <CardTitle className="text-base">Filters and review</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-6">
            <QueuePill label="Sheets in current view" value={String(sheets.length)} />
            <QueuePill label="Review statuses" value="Draft / Pending / Approved" />
            <QueuePill label="Exports ready" value="CSV / Excel / PDF" />
          </CardContent>
        </Card>
      </section>

      <form className="grid gap-3 rounded-[24px] border border-border/70 bg-card px-4 py-4 md:grid-cols-[auto_auto_auto_auto]" method="get">
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
        <div className="flex gap-2">
          <Button type="submit">Apply</Button>
          <Button asChild variant="outline">
            <Link href="/app/wages">Reset</Link>
          </Button>
        </div>
      </form>

      <ApprovalStatusGuide />

      <Card>
        <CardHeader className="border-b border-border/60">
          <CardTitle className="text-base">Wage ledger</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
          <Table className="min-w-[920px]">
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Project</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="hidden md:table-cell">Mode</TableHead>
                <TableHead className="hidden md:table-cell">Reference</TableHead>
                <TableHead className="hidden md:table-cell">Review</TableHead>
                <TableHead className="hidden md:table-cell text-right">Lines</TableHead>
                <TableHead className="text-right">Open</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sheets.length === 0 ? (
                <TableEmptyState
                  colSpan={8}
                  title="No wage sheets matched this view"
                  description="Try widening the date range or clearing the current approval filter."
                />
              ) : (
                sheets.map((sheet) => (
                  <TableRow key={sheet.id}>
                    <TableCell>{sheet.date.toISOString().slice(0, 10)}</TableCell>
                    <TableCell className="max-w-[320px] truncate font-semibold">
                      <Link className="hover:underline" href={`/app/wages/${sheet.id}`}>
                        {sheet.project.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatINR(Number(sheet.total))}</TableCell>
                    <TableCell className="hidden md:table-cell">{sheet.mode}</TableCell>
                    <TableCell className="hidden max-w-[220px] truncate md:table-cell">{sheet.reference ?? "-"}</TableCell>
                    <TableCell className="hidden md:table-cell"><ApprovalStatusBadge status={sheet.approvalStatus} /></TableCell>
                    <TableCell className="hidden md:table-cell text-right">{lineCountBySheetId.get(sheet.id) ?? 0}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="secondary">
                        <Link href={`/app/wages/${sheet.id}`}>View</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>
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
    <div className="min-w-0 rounded-[22px] border border-border/60 bg-background/70 px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <div className="mt-4 min-w-0 text-xl font-semibold leading-tight tracking-tight [overflow-wrap:anywhere] sm:text-2xl">
        {value}
      </div>
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
