import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";

import { ApprovalStatusControl } from "@/components/app/approval-status-control";
import { ModuleCheatSheet } from "@/components/help/module-cheat-sheet";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatINR } from "@/lib/money";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

import { deleteExpense } from "../actions";

import { ExpenseEditForm } from "./expense-edit-form";

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
  const taxTotal = cgst + sgst + igst;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Expense workspace</h1>
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

      <section className="grid gap-4 lg:grid-cols-4">
        <MetricCard label="Total" value={formatINR(total)} />
        <MetricCard label="Pre-tax value" value={formatINR(amountBeforeTax)} />
        <MetricCard label="Tax total" value={formatINR(taxTotal)} />
        <MetricCard label="Counterparty" value={expense.vendor?.name ?? expense.labourer?.name ?? "—"} />
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_360px] xl:items-start">
        <div className="space-y-6">
          <Card>
            <CardHeader className="border-b border-border/60">
              <CardTitle className="text-base">Review status</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <ApprovalStatusControl target="expense" id={expense.id} status={expense.approvalStatus} showHelp />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b border-border/60">
              <CardTitle className="text-base">Edit expense</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <ExpenseEditForm
                tenantId={session.user.tenantId}
                expense={{
                  id: expense.id,
                  projectId: expense.projectId,
                  vendorId: expense.vendorId ?? "",
                  labourerId: expense.labourerId ?? "",
                  date: dateOnly(expense.date),
                  expenseType: expense.expenseType,
                  paymentMode: expense.paymentMode ?? "",
                  amountBeforeTax: amountBeforeTax.toFixed(2),
                  cgst: cgst.toFixed(2),
                  sgst: sgst.toFixed(2),
                  igst: igst.toFixed(2),
                  narration: expense.narration ?? "",
                }}
                projects={projects}
                vendors={vendors}
                labourers={labourers}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="border-b border-border/60">
              <CardTitle className="text-base">Operational context</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-6 text-sm">
              <DetailRow label="Expense type" value={expense.expenseType} />
              <DetailRow label="Paid via" value={expense.paymentMode ?? "Not marked paid"} />
              <DetailRow label="Vendor" value={expense.vendor?.name ?? "—"} />
              <DetailRow label="Labour" value={expense.labourer?.name ?? "—"} />
              <DetailRow label="Narration" value={expense.narration ?? "No notes"} />
              <DetailRow label="Attachments" value={String(attachments.length)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b border-border/60">
              <CardTitle className="text-base">Attachments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-6">
              {attachments.length === 0 ? (
                <div className="text-sm text-muted-foreground">No bills uploaded yet.</div>
              ) : (
                attachments.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-3 rounded-[18px] border border-border/60 bg-background/70 px-4 py-3">
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
                ))
              )}
            </CardContent>
          </Card>

          <ModuleCheatSheet moduleKey="expenses" variant="sidebar" showDecisionHints showRoutingTrigger />
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="text-lg font-semibold tracking-tight [overflow-wrap:anywhere]">{value}</CardContent>
    </Card>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="text-muted-foreground">{label}</div>
      <div className="text-right font-medium">{value}</div>
    </div>
  );
}
