import Link from "next/link";

import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ReportsHomePage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <PageHeader title="Reports" description="Project and finance reports dashboard." />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Monthly Outflows</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div>Export the monthly outflow register across bills, expenses, wages, and payments made.</div>
            <Button asChild>
              <Link href="/app/reports/monthly-expenses">Open Monthly Export</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Receivables Aging</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <div>Track outstanding client invoices by aging bucket and project scope.</div>
            <Button asChild>
              <Link href="/app/reports/receivables-aging">Open Receivables Aging</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payables Aging</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <div>Track unpaid vendor bills by age so you can plan dues and cash needs.</div>
            <Button asChild>
              <Link href="/app/reports/payables-aging">Open Payables Aging</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Client Ledger</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <div>See invoice and receipt movement with opening balance, running receivable balance, and exports.</div>
            <Button asChild>
              <Link href="/app/reports/client-ledger">Open Client Ledger</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Vendor Ledger</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <div>See bill and payment movement with opening balance, running payable balance, and exports.</div>
            <Button asChild>
              <Link href="/app/reports/vendor-ledger">Open Vendor Ledger</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>GST Purchase Register</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <div>Combine purchase bills and direct expenses into an export-ready GST input register.</div>
            <Button asChild>
              <Link href="/app/reports/gst-purchase-register">Open Purchase Register</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>GST Sales Register</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <div>Track invoice-date GST output rows with receipt linkage against each invoice.</div>
            <Button asChild>
              <Link href="/app/reports/gst-sales-register">Open Sales Register</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>TDS Dashboard</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <div>Review FY-wide TDS deducted, paid, and pending across Section 194C and Section 194T.</div>
            <Button asChild>
              <Link href="/app/reports/tds-dashboard">Open TDS Dashboard</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Next in Phase 1</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <div>Approval statuses, audit trail, month lock, and mobile list redesign kickoff.</div>
            <div className="rounded-md border bg-muted/20 p-2">Backlog is documented in `docs/product-roadmap.md`.</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
