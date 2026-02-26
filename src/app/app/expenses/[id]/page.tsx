import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { formatINR } from "@/lib/money";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

import { deleteExpense, updateExpense } from "../actions";

function dateOnly(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function ExpenseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const { id } = await params;

  const expense = await prisma.expense.findUnique({
    where: { id, tenantId: session.user.tenantId },
    include: {
      project: { select: { id: true, name: true } },
      vendor: { select: { id: true, name: true } },
      labourer: { select: { id: true, name: true } },
    },
  });
  if (!expense) return null;

  const attachments = await prisma.attachment.findMany({
    where: { tenantId: session.user.tenantId, entityType: "EXPENSE", entityId: expense.id },
    orderBy: { createdAt: "desc" },
  });

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

  const total = Number(expense.totalAmount);
  const amountBeforeTax = Number(expense.amountBeforeTax);
  const cgst = Number(expense.cgst);
  const sgst = Number(expense.sgst);
  const igst = Number(expense.igst);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Expense</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {expense.project.name} • {dateOnly(expense.date)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/app/expenses">Back</Link>
          </Button>
          <form
            action={async () => {
              "use server";
              await deleteExpense(expense.id);
              redirect("/app/expenses");
            }}
          >
            <Button variant="destructive" type="submit">
              Delete
            </Button>
          </form>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total</CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-semibold tabular-nums">{formatINR(total)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Paid via</CardTitle>
          </CardHeader>
          <CardContent className="text-sm font-medium">{expense.paymentMode ?? "—"}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Vendor / Labour</CardTitle>
          </CardHeader>
          <CardContent className="text-sm font-medium">{expense.vendor?.name ?? expense.labourer?.name ?? "—"}</CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Edit</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updateExpense} className="space-y-4">
              <input type="hidden" name="id" value={expense.id} />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-sm">
                  <div className="text-muted-foreground">Project</div>
                  <select
                    name="projectId"
                    className="h-10 w-full rounded-md border bg-background px-3"
                    defaultValue={expense.projectId}
                    required
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2 text-sm">
                  <div className="text-muted-foreground">Date</div>
                  <Input type="date" name="date" defaultValue={dateOnly(expense.date)} required />
                </label>

                <label className="space-y-2 text-sm">
                  <div className="text-muted-foreground">Expense Type</div>
                  <select
                    name="expenseType"
                    className="h-10 w-full rounded-md border bg-background px-3"
                    defaultValue={expense.expenseType}
                  >
                    <option value="MATERIAL">Material</option>
                    <option value="LABOUR">Labour</option>
                    <option value="SUBCONTRACTOR">Subcontractor</option>
                    <option value="OVERHEAD">Overhead</option>
                  </select>
                </label>

                <label className="space-y-2 text-sm">
                  <div className="text-muted-foreground">Paid via (optional)</div>
                  <select
                    name="paymentMode"
                    className="h-10 w-full rounded-md border bg-background px-3"
                    defaultValue={expense.paymentMode ?? ""}
                  >
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
                  <select
                    name="vendorId"
                    className="h-10 w-full rounded-md border bg-background px-3"
                    defaultValue={expense.vendorId ?? ""}
                  >
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
                  <select
                    name="labourerId"
                    className="h-10 w-full rounded-md border bg-background px-3"
                    defaultValue={expense.labourerId ?? ""}
                  >
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
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    name="amountBeforeTax"
                    defaultValue={amountBeforeTax.toFixed(2)}
                    required
                  />
                </label>
                <label className="space-y-2 text-sm">
                  <div className="text-muted-foreground">CGST</div>
                  <Input type="number" inputMode="decimal" step="0.01" name="cgst" defaultValue={cgst.toFixed(2)} />
                </label>
                <label className="space-y-2 text-sm">
                  <div className="text-muted-foreground">SGST</div>
                  <Input type="number" inputMode="decimal" step="0.01" name="sgst" defaultValue={sgst.toFixed(2)} />
                </label>
                <label className="space-y-2 text-sm">
                  <div className="text-muted-foreground">IGST</div>
                  <Input type="number" inputMode="decimal" step="0.01" name="igst" defaultValue={igst.toFixed(2)} />
                </label>
              </div>

              <label className="block space-y-2 text-sm">
                <div className="text-muted-foreground">Narration (optional)</div>
                <Textarea name="narration" defaultValue={expense.narration ?? ""} rows={2} />
              </label>

              <label className="block space-y-2 text-sm">
                <div className="text-muted-foreground">Upload bill (optional)</div>
                <Input type="file" name="bill" accept="image/*,application/pdf" />
              </label>

              <div className="flex justify-end">
                <Button type="submit">Save changes</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Attachments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {attachments.length === 0 ? (
              <div className="text-sm text-muted-foreground">No bills uploaded yet.</div>
            ) : (
              <div className="space-y-2">
                {attachments.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{a.originalName}</div>
                      <div className="text-xs text-muted-foreground">{a.mimeType}</div>
                    </div>
                    <Button asChild size="sm" variant="outline">
                      <a href={`/api/attachments/${a.id}`} target="_blank" rel="noreferrer">
                        Open
                      </a>
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <div className="text-xs text-muted-foreground">
              Uploaded bills are stored in Vercel Blob when configured.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
