import Link from "next/link";

import { ExportLinks } from "@/components/app/export-links";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatINR } from "@/lib/money";
import { type GstRegisterReport } from "@/server/reports/gst";

export function GstRegisterView({
  report,
  hrefBase,
  resetHref,
  projectName,
}: {
  report: GstRegisterReport;
  hrefBase: string;
  resetHref: string;
  projectName?: string | null;
}) {
  const isSales = report.kind === "sales";

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <PageHeader
        title={report.title}
        description="Tax register with export-ready rows and summary totals for the selected period."
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Rows</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">{report.summary.rowCount}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Taxable value</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">{formatINR(report.summary.taxableValue)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">CGST</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">{formatINR(report.summary.cgst)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">SGST</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">{formatINR(report.summary.sgst)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">IGST</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">{formatINR(report.summary.igst)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">{isSales ? "Invoice total" : "Gross total"}</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">{formatINR(report.summary.total)}</CardContent>
        </Card>
      </div>

      {isSales ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Receipts linked</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">{formatINR(report.summary.settledAmount ?? 0)}</CardContent>
        </Card>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Input tax credit</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">{formatINR(report.liabilitySummary.inputTaxCredit)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Output tax</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">{formatINR(report.liabilitySummary.outputTax)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Net GST payable</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">{formatINR(report.liabilitySummary.netPayable)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Excess ITC</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">{formatINR(report.liabilitySummary.excessItc)}</CardContent>
        </Card>
      </section>

      {report.note ? <div className="rounded-md border bg-muted/20 p-4 text-sm text-muted-foreground">{report.note}</div> : null}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  {report.kind === "purchase" ? <TableHead>Source</TableHead> : null}
                  <TableHead>Project</TableHead>
                  <TableHead>{report.kind === "purchase" ? "Vendor / Payee" : "Client"}</TableHead>
                  <TableHead>GSTIN</TableHead>
                  <TableHead>{report.kind === "purchase" ? "Document" : "Invoice #"}</TableHead>
                  <TableHead>GST Type</TableHead>
                  <TableHead>GST Rate</TableHead>
                  <TableHead className="text-right">Taxable</TableHead>
                  <TableHead className="text-right">CGST</TableHead>
                  <TableHead className="text-right">SGST</TableHead>
                  <TableHead className="text-right">IGST</TableHead>
                  {report.kind === "purchase" ? <TableHead className="text-right">ITC</TableHead> : null}
                  <TableHead className="text-right">Total</TableHead>
                  {isSales ? <TableHead className="text-right">Receipts</TableHead> : null}
                  {isSales ? <TableHead className="text-right">Count</TableHead> : null}
                  <TableHead>Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isSales ? 16 : 15} className="py-10 text-center text-sm text-muted-foreground">
                      No rows for this period.
                    </TableCell>
                  </TableRow>
                ) : (
                  report.rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap">{row.date}</TableCell>
                      {report.kind === "purchase" ? <TableCell>{row.sourceType}</TableCell> : null}
                      <TableCell className="max-w-[220px] truncate">{row.projectName}</TableCell>
                      <TableCell className="max-w-[220px] truncate">{row.partyName}</TableCell>
                      <TableCell className="whitespace-nowrap">{row.partyGstin || "-"}</TableCell>
                      <TableCell className="max-w-[220px] truncate font-medium">{row.documentNumber}</TableCell>
                      <TableCell>{row.gstType}</TableCell>
                      <TableCell>{row.gstRateLabel || "-"}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatINR(row.taxableValue)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatINR(row.cgst)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatINR(row.sgst)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatINR(row.igst)}</TableCell>
                      {report.kind === "purchase" ? <TableCell className="text-right tabular-nums">{formatINR(row.inputTaxCredit ?? 0)}</TableCell> : null}
                      <TableCell className="text-right tabular-nums">{formatINR(row.total)}</TableCell>
                      {isSales ? <TableCell className="text-right tabular-nums">{formatINR(row.settledAmount ?? 0)}</TableCell> : null}
                      {isSales ? <TableCell className="text-right tabular-nums">{row.linkedCount ?? 0}</TableCell> : null}
                      <TableCell className="max-w-[280px] truncate">{row.note || "-"}</TableCell>
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
