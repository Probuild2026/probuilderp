import Link from "next/link";

import { ExportLinks } from "@/components/app/export-links";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatINR } from "@/lib/money";
import { type TdsDashboardReport } from "@/server/reports/tds";

export function TdsDashboardView({
  report,
  hrefBase,
  resetHref,
}: {
  report: TdsDashboardReport;
  hrefBase: string;
  resetHref: string;
}) {
  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <PageHeader
        title={report.title}
        description="FY-wide TDS summary across vendor deductions (194C) and partner remuneration (194T)."
        actions={
          <>
            <ExportLinks hrefBase={hrefBase} params={{ fy: report.fy }} />
            <Button asChild variant="outline">
              <Link href="/app/reports">Back to reports</Link>
            </Button>
          </>
        }
        filters={
          <form className="flex items-end gap-2" method="get">
            <div>
              <label className="text-xs text-muted-foreground">Financial year</label>
              <input
                name="fy"
                defaultValue={report.fy}
                className="h-10 w-32 rounded-md border bg-background px-3 text-sm"
                placeholder="2026-27"
              />
            </div>
            <Button type="submit" variant="outline">
              Apply
            </Button>
            <Button asChild variant="outline">
              <Link href={resetHref}>Reset</Link>
            </Button>
          </form>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total deducted</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">{formatINR(report.totalDeducted)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total paid</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">{formatINR(report.totalPaid)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total pending</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">{formatINR(report.totalPending)}</CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {report.sections.map((section) => (
          <Card key={section.section}>
            <CardHeader className="pb-2">
              <CardTitle>{section.section}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Deducted</span>
                <span className="font-medium">{formatINR(section.deducted)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Paid</span>
                <span className="font-medium">{formatINR(section.paid)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Pending</span>
                <span className="font-medium">{formatINR(section.pending)}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {report.note ? <div className="rounded-md border bg-muted/20 p-4 text-sm text-muted-foreground">{report.note}</div> : null}

      <Card>
        <CardHeader>
          <CardTitle>Section 194C</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendor</TableHead>
                  <TableHead className="text-right">Gross paid</TableHead>
                  <TableHead className="text-right">Taxable base</TableHead>
                  <TableHead className="text-right">TDS deducted</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Pending</TableHead>
                  <TableHead>Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.vendorRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                      No 194C rows for this FY.
                    </TableCell>
                  </TableRow>
                ) : (
                  report.vendorRows.map((row) => (
                    <TableRow key={row.vendorId}>
                      <TableCell className="font-medium">{row.vendorName}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatINR(row.grossPaid)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatINR(row.taxableBase)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatINR(row.tdsDeducted)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatINR(row.tdsPaid)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatINR(row.tdsPending)}</TableCell>
                      <TableCell className="max-w-[320px] truncate">{row.note || "-"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Section 194T</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Partner</TableHead>
                  <TableHead className="text-right">Gross remuneration</TableHead>
                  <TableHead className="text-right">TDS deducted</TableHead>
                  <TableHead className="text-right">TDS paid</TableHead>
                  <TableHead className="text-right">Pending</TableHead>
                  <TableHead>Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.partnerRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                      No 194T rows for this FY.
                    </TableCell>
                  </TableRow>
                ) : (
                  report.partnerRows.map((row) => (
                    <TableRow key={row.partnerId}>
                      <TableCell className="font-medium">{row.partnerName}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatINR(row.grossAmount)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatINR(row.tdsDeducted)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatINR(row.tdsPaid)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatINR(row.tdsPending)}</TableCell>
                      <TableCell className="max-w-[320px] truncate">{row.note || "-"}</TableCell>
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
