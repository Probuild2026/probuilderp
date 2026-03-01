import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

import { createReceipt } from "../actions";

export default async function NewReceiptPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const invoices = await prisma.clientInvoice.findMany({
    where: { tenantId: session.user.tenantId },
    orderBy: [{ invoiceDate: "desc" }, { createdAt: "desc" }],
    take: 300,
    select: {
      id: true,
      invoiceNumber: true,
      invoiceDate: true,
      total: true,
      project: { select: { name: true } },
      client: { select: { name: true } },
    },
  });

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">New receipt</h1>
          <p className="mt-1 text-sm text-muted-foreground">Record money received from a client (including TDS).</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/app/sales/receipts">Back</Link>
        </Button>
      </div>

      <form action={createReceipt} className="space-y-5 rounded-md border p-4 md:p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="space-y-2 text-sm sm:col-span-2">
            <div className="text-muted-foreground">Invoice</div>
            <select name="clientInvoiceId" className="h-10 w-full rounded-md border bg-background px-3" required>
              {invoices.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.invoiceNumber} — {inv.client.name} — {inv.project.name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2 text-sm">
            <div className="text-muted-foreground">Date</div>
            <Input type="date" name="date" defaultValue={today} required />
          </label>

          <label className="space-y-2 text-sm">
            <div className="text-muted-foreground">Mode</div>
            <select name="mode" className="h-10 w-full rounded-md border bg-background px-3" defaultValue="BANK_TRANSFER">
              <option value="CASH">Cash</option>
              <option value="UPI">UPI</option>
              <option value="BANK_TRANSFER">Bank transfer</option>
              <option value="CHEQUE">Cheque</option>
              <option value="CARD">Card</option>
              <option value="OTHER">Other</option>
            </select>
          </label>

          <label className="space-y-2 text-sm">
            <div className="text-muted-foreground">Amount received</div>
            <Input name="amountReceived" type="number" inputMode="decimal" step="0.01" required />
          </label>

          <label className="space-y-2 text-sm">
            <div className="text-muted-foreground">Reference (optional)</div>
            <Input name="reference" placeholder="UPI/NEFT/IMPS ref..." />
          </label>
        </div>

        <div className="rounded-md border p-3">
          <label className="flex items-center gap-3 text-sm">
            <input className="size-4 accent-primary" type="checkbox" name="tdsDeducted" value="1" />
            <span>TDS deducted by client</span>
          </label>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm">
              <div className="text-muted-foreground">TDS amount (optional)</div>
              <Input name="tdsAmount" type="number" inputMode="decimal" step="0.01" defaultValue="0" />
            </label>
            <label className="space-y-2 text-sm">
              <div className="text-muted-foreground">Remarks (optional)</div>
              <Input name="remarks" placeholder="e.g. TDS certificate pending" />
            </label>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            Receipt settlement uses Allocation: gross = cash received + TDS.
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <Button type="submit">Save receipt</Button>
        </div>
      </form>
    </div>
  );
}

