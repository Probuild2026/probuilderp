import Link from "next/link";

import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ReportsHomePage() {
  const cards = [
    {
      title: "Monthly Outflows",
      description: "Export the monthly outflow register across bills, expenses, wages, and payments made.",
      href: "/app/reports/monthly-expenses",
      cta: "Open Monthly Export",
      tone: "from-[rgba(221,235,255,0.5)] to-white",
    },
    {
      title: "Receivables Aging",
      description: "Track outstanding client invoices by aging bucket and project scope.",
      href: "/app/reports/receivables-aging",
      cta: "Open Receivables Aging",
      tone: "from-[rgba(217,246,233,0.52)] to-white",
    },
    {
      title: "Payables Aging",
      description: "Track unpaid vendor bills by age so you can plan dues and cash needs.",
      href: "/app/reports/payables-aging",
      cta: "Open Payables Aging",
      tone: "from-[rgba(255,241,205,0.52)] to-white",
    },
    {
      title: "Client Ledger",
      description: "See invoice and receipt movement with opening balance, running receivable balance, and exports.",
      href: "/app/reports/client-ledger",
      cta: "Open Client Ledger",
      tone: "from-[rgba(233,229,255,0.46)] to-white",
    },
    {
      title: "Vendor Ledger",
      description: "See bill and payment movement with opening balance, running payable balance, and exports.",
      href: "/app/reports/vendor-ledger",
      cta: "Open Vendor Ledger",
      tone: "from-[rgba(221,235,255,0.5)] to-white",
    },
    {
      title: "GST Purchase Register",
      description: "Combine purchase bills and direct expenses into an export-ready GST input register.",
      href: "/app/reports/gst-purchase-register",
      cta: "Open Purchase Register",
      tone: "from-[rgba(255,239,210,0.48)] to-white",
    },
    {
      title: "GST Sales Register",
      description: "Track invoice-date GST output rows with receipt linkage against each invoice.",
      href: "/app/reports/gst-sales-register",
      cta: "Open Sales Register",
      tone: "from-[rgba(255,225,217,0.48)] to-white",
    },
    {
      title: "TDS Dashboard",
      description: "Review FY-wide TDS deducted, paid, and pending across Section 194C and Section 194T.",
      href: "/app/reports/tds-dashboard",
      cta: "Open TDS Dashboard",
      tone: "from-[rgba(223,241,232,0.5)] to-white",
    },
    {
      title: "Audit Log",
      description: "See who created, changed, deleted, exported, or reclassified finance records.",
      href: "/app/reports/audit-log",
      cta: "Open Audit Log",
      tone: "from-[rgba(234,238,248,0.5)] to-white",
    },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <PageHeader eyebrow="Finance / Reports" title="Reports" description="Project and finance reports dashboard." />

      <div className="grid gap-4 md:grid-cols-2">
        {cards.map((card) => (
          <Card key={card.href} className={`bg-gradient-to-br ${card.tone}`}>
            <CardHeader>
              <CardTitle>{card.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div>{card.description}</div>
              <Button asChild variant="outline">
                <Link href={card.href}>{card.cta}</Link>
              </Button>
            </CardContent>
          </Card>
        ))}

        <Card>
          <CardHeader>
            <CardTitle>Next in Phase 1</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <div>Month lock, close controls, and mobile-first list redesign are the next finance-control items.</div>
            <div className="rounded-md border bg-muted/20 p-2">Backlog is documented in `docs/product-roadmap.md`.</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
