import Link from "next/link";
import { getServerSession } from "next-auth/next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

import { createExpense } from "../actions";

export default async function NewExpensePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const [projects, vendors, labourers] = await Promise.all([
    prisma.project.findMany({
      where: { tenantId: session.user.tenantId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.vendor.findMany({
      where: { tenantId: session.user.tenantId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.labourer.findMany({
      where: { tenantId: session.user.tenantId, active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">New Expense</h1>
          <p className="mt-1 text-sm text-muted-foreground">Daily expenses with optional bill upload.</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/app/expenses">Back</Link>
        </Button>
      </div>

      <form action={createExpense} className="space-y-5 rounded-md border p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="space-y-2 text-sm">
            <div className="text-muted-foreground">Project</div>
            <select name="projectId" className="h-10 w-full rounded-md border bg-background px-3" required>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2 text-sm">
            <div className="text-muted-foreground">Date</div>
            <Input type="date" name="date" defaultValue={today} required />
          </label>

          <label className="space-y-2 text-sm">
            <div className="text-muted-foreground">Expense Type</div>
            <select name="expenseType" className="h-10 w-full rounded-md border bg-background px-3" defaultValue="OVERHEAD">
              <option value="MATERIAL">Material</option>
              <option value="LABOUR">Labour</option>
              <option value="SUBCONTRACTOR">Subcontractor</option>
              <option value="OVERHEAD">Overhead</option>
            </select>
          </label>

          <label className="space-y-2 text-sm">
            <div className="text-muted-foreground">Paid via (optional)</div>
            <select name="paymentMode" className="h-10 w-full rounded-md border bg-background px-3" defaultValue="">
              <option value="">Unpaid / not recorded</option>
              <option value="UPI">UPI</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="CASH">Cash</option>
              <option value="CHEQUE">Cheque</option>
              <option value="CARD">Card</option>
              <option value="OTHER">Other</option>
            </select>
          </label>
        </div>

        <Separator />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="space-y-2 text-sm">
            <div className="text-muted-foreground">Vendor (optional)</div>
            <select name="vendorId" className="h-10 w-full rounded-md border bg-background px-3" defaultValue="">
              <option value="">—</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2 text-sm">
            <div className="text-muted-foreground">Labourer (optional)</div>
            <select name="labourerId" className="h-10 w-full rounded-md border bg-background px-3" defaultValue="">
              <option value="">—</option>
              {labourers.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <Separator />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="space-y-2 text-sm">
            <div className="text-muted-foreground">Amount before tax</div>
            <Input type="number" inputMode="decimal" step="0.01" name="amountBeforeTax" defaultValue="0" required />
          </label>
          <label className="space-y-2 text-sm">
            <div className="text-muted-foreground">CGST</div>
            <Input type="number" inputMode="decimal" step="0.01" name="cgst" defaultValue="0" />
          </label>
          <label className="space-y-2 text-sm">
            <div className="text-muted-foreground">SGST</div>
            <Input type="number" inputMode="decimal" step="0.01" name="sgst" defaultValue="0" />
          </label>
          <label className="space-y-2 text-sm">
            <div className="text-muted-foreground">IGST</div>
            <Input type="number" inputMode="decimal" step="0.01" name="igst" defaultValue="0" />
          </label>
        </div>

        <label className="block space-y-2 text-sm">
          <div className="text-muted-foreground">Narration (optional)</div>
          <Input name="narration" placeholder="Notes / what this was for" />
        </label>

        <label className="block space-y-2 text-sm">
          <div className="text-muted-foreground">Upload bill (optional)</div>
          <Input type="file" name="bill" accept="image/*,application/pdf" />
        </label>

        <div className="flex items-center justify-end gap-3">
          <Button type="submit">Save</Button>
        </div>
      </form>
    </div>
  );
}

