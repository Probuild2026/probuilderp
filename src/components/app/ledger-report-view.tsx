import Link from "next/link";

import { ExportLinks } from "@/components/app/export-links";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatINR } from "@/lib/money";
import { type LedgerReport } from "@/server/reports/ledger";

const typeLabels = {
  OPENING_BALANCE: "Opening balance",
  INVOICE: "Invoice",
  RECEIPT: "Receipt",
  BILL: "Bill",
  PAYMENT: "Payment",
} as const;

export function LedgerReportView({
  report,
  hrefBase,
  resetHref,
  projectName,
}: {
  report: LedgerReport;
  hrefBase: string;
  resetHref: string;
  projectName?: string | null;
}) {
  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <PageHeader
        title={report.title}
        description="Chronological control ledger with opening balance, in-period movement, and closing balance."
        actions={
          <>
            <ExportLinks hrefBase={hrefBase} params={{ from: report.from, to: report.to }} />
            <Button asChild variant="outline">
              <Link href="/app/reports">Back to reports</Link>
            </Button>
          </>
        }
        filters={
          <div className="text-sm text-muted-foreground">
            Project scope: <span className="text-foreground">{projectName ?? "All projects"}</span>
          </div>
        }
      />

      <form className="grid gap-2 rounded-md border p-3 md:grid-cols-[auto_auto_auto]" method="get">
        <Input name="from" type="date" defaultValue={report.from} />
        <Input name="to" type="date" defaultValue={report.to} />
        <div className="flex gap-2">
          <Button type="submit">Apply</Button>
          <Button asChild variant="outline">
            <Link href={resetHref}>Reset</Link>
          </Button>
        </div>
      </form>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Opening balance</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">{formatINR(report.openingBalance)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">{report.increaseLabel}</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">{formatINR(report.totalIncrease)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">{report.decreaseLabel}</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">{formatINR(report.totalDecrease)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">{report.balanceLabel}</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">{formatINR(report.closingBalance)}</CardContent>
        </Card>
      </div>

      {report.note ? <div className="rounded-md border bg-muted/20 p-4 text-sm text-muted-foreground">{report.note}</div> : null}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>{report.partyLabel}</TableHead>
                  <TableHead>Document</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead className="text-right">{report.increaseLabel}</TableHead>
                  <TableHead className="text-right">{report.decreaseLabel}</TableHead>
                  <TableHead className="text-right">Running balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.from ? (
                  <TableRow>
                    <TableCell className="whitespace-nowrap">{report.from}</TableCell>
                    <TableCell>{typeLabels.OPENING_BALANCE}</TableCell>
                    <TableCell />
                    <TableCell />
                    <TableCell className="font-medium">Opening balance</TableCell>
                    <TableCell />
                    <TableCell />
                    <TableCell />
                    <TableCell className="text-right">-</TableCell>
                    <TableCell className="text-right">-</TableCell>
                    <TableCell className="text-right tabular-nums">{formatINR(report.openingBalance)}</TableCell>
                  </TableRow>
                ) : null}

                {report.rows.length === 0 ? (
                  !report.from ? (
                    <TableRow>
                      <TableCell colSpan={11} className="py-10 text-center text-sm text-muted-foreground">
                        No ledger movement for this scope.
                      </TableCell>
                    </TableRow>
                  ) : null
                ) : (
                  report.rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap">{row.date}</TableCell>
                      <TableCell>{typeLabels[row.type]}</TableCell>
                      <TableCell className="max-w-[220px] truncate">{row.projectName || "-"}</TableCell>
                      <TableCell className="max-w-[220px] truncate">{row.partyName || "-"}</TableCell>
                      <TableCell className="max-w-[220px] truncate font-medium">{row.documentNumber || "-"}</TableCell>
                      <TableCell className="max-w-[180px] truncate">{row.reference || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{row.mode || "-"}</TableCell>
                      <TableCell className="max-w-[280px] truncate">{row.note || "-"}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.increaseAmount ? formatINR(row.increaseAmount) : "-"}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.decreaseAmount ? formatINR(row.decreaseAmount) : "-"}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatINR(row.runningBalance)}</TableCell>
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
