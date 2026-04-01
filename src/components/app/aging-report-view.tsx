import Link from "next/link";

import { ExportLinks } from "@/components/app/export-links";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatINR } from "@/lib/money";
import { type AgingReport } from "@/server/reports/aging";

export function AgingReportView({
  report,
  hrefBase,
  projectName,
}: {
  report: AgingReport;
  hrefBase: string;
  projectName?: string | null;
}) {
  const totalOutstanding = report.summary.reduce((acc, item) => acc + item.amount, 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <PageHeader
        title={report.title}
        description="Actionable aging buckets for collections and vendor dues."
        actions={
          <>
            <ExportLinks hrefBase={hrefBase} params={{ asOf: report.asOf }} />
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

      <form className="flex flex-wrap items-end gap-3 rounded-md border p-3" method="get">
        <label className="space-y-2 text-sm">
          <div className="text-muted-foreground">As of</div>
          <Input type="date" name="asOf" defaultValue={report.asOf} />
        </label>
        <Button type="submit">Update</Button>
      </form>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total outstanding</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">{formatINR(totalOutstanding)}</CardContent>
        </Card>
        {report.summary.map((item) => (
          <Card key={item.bucket}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">{item.label}</CardTitle>
            </CardHeader>
            <CardContent className="text-xl font-semibold">{formatINR(item.amount)}</CardContent>
          </Card>
        ))}
      </div>

      {report.note ? (
        <div className="rounded-md border bg-muted/20 p-4 text-sm text-muted-foreground">{report.note}</div>
      ) : null}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Age basis</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Party</TableHead>
                  <TableHead>Document</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Settled</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  <TableHead className="text-right">Age days</TableHead>
                  <TableHead>Bucket</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="py-10 text-center text-sm text-muted-foreground">
                      No outstanding items for this scope.
                    </TableCell>
                  </TableRow>
                ) : (
                  report.rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap">{row.documentDate}</TableCell>
                      <TableCell className="whitespace-nowrap">{row.basisDate}</TableCell>
                      <TableCell className="max-w-[220px] truncate">{row.projectName}</TableCell>
                      <TableCell className="max-w-[220px] truncate">{row.partyName}</TableCell>
                      <TableCell className="font-medium">{row.documentNumber}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatINR(row.totalAmount)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatINR(row.settledAmount)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatINR(row.outstandingAmount)}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.ageDays}</TableCell>
                      <TableCell>{row.bucket.replaceAll("_", "-")}</TableCell>
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
