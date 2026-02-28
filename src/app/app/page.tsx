import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AppHomePage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Quick guide + shortcuts for daily use.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary">
            <Link href="/app/settings/business">Business settings</Link>
          </Button>
          <Button asChild>
            <Link href="/app/transactions/new">New transaction</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Simple rule to remember</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            <li>
              <span className="text-foreground">Bills</span> = Purchase/expense from a vendor where you get a bill/invoice.
            </li>
            <li>
              <span className="text-foreground">Payments Made</span> = How you paid that bill (Cash / UPI / Bank Transfer etc.).
            </li>
            <li>
              <span className="text-foreground">Receipts</span> = Money received from client.
            </li>
          </ul>

          <div className="grid gap-2 sm:grid-cols-3">
            <Button asChild variant="outline" className="justify-start">
              <Link href="/app/purchases/bills">Go to Bills</Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link href="/app/purchases/payments-made">Go to Payments Made</Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link href="/app/sales/receipts">Go to Receipts</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Setup checklist</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <div>
              1) <Link className="text-foreground underline underline-offset-4" href="/app/settings/business">Business</Link>:
              logo, GSTIN/PAN, address, bank/UPI (used on invoices/receipts/vouchers).
            </div>
            <div>
              2) Masters:{" "}
              <Link className="text-foreground underline underline-offset-4" href="/app/clients">Clients</Link>,{" "}
              <Link className="text-foreground underline underline-offset-4" href="/app/vendors">Vendors/Subcontractors</Link>,{" "}
              <Link className="text-foreground underline underline-offset-4" href="/app/projects">Projects</Link>.
            </div>
            <div>
              3) Daily entries:{" "}
              <Link className="text-foreground underline underline-offset-4" href="/app/expenses">Expenses</Link> and{" "}
              <Link className="text-foreground underline underline-offset-4" href="/app/wages">Wages</Link>.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">When to use Transactions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <div>
              Use <span className="text-foreground">Transactions</span> for quick cashbook entries (income/expense/transfer) when you don’t have a bill or
              invoice yet.
            </div>
            <div>
              For vendor bills + payments, prefer{" "}
              <Link className="text-foreground underline underline-offset-4" href="/app/purchases/bills">Bills</Link> and{" "}
              <Link className="text-foreground underline underline-offset-4" href="/app/purchases/payments-made">Payments Made</Link>.
            </div>
            <div>
              For client money received, use{" "}
              <Link className="text-foreground underline underline-offset-4" href="/app/sales/receipts">Receipts</Link>.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
