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
            <CardTitle>Monthly CSV</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div>Export monthly expenses with project and category filters.</div>
            <Button asChild>
              <Link href="/app/reports/monthly-expenses">Open Monthly CSV</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>More reports</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <div>Receivables aging, GST/TDS summaries, and profitability snapshots are being added next.</div>
            <div className="rounded-md border bg-muted/20 p-2">Coming soon</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
