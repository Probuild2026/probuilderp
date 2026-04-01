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
            <CardTitle>Next in Phase 1</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <div>Vendor ledger, client ledger, GST registers, TDS dashboard, approvals, audit trail, and month lock.</div>
            <div className="rounded-md border bg-muted/20 p-2">Backlog is documented in `docs/product-roadmap.md`.</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
