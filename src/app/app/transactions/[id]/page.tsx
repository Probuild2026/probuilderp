import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { notFound, redirect } from "next/navigation";

import { ApprovalStatusControl } from "@/components/app/approval-status-control";
import { ModuleCheatSheet } from "@/components/help/module-cheat-sheet";
import { InlineEmptyState } from "@/components/app/state-panels";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatINR } from "@/lib/money";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

import { TransactionEditForm } from "./transaction-edit-form";

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function accountFlowLabel(type: string, fromLabel: string | null, toLabel: string | null) {
  if (type === "TRANSFER") return `${fromLabel ?? "—"} -> ${toLabel ?? "—"}`;
  if (type === "INCOME") return `Into ${toLabel ?? "—"}`;
  return `From ${fromLabel ?? "—"}`;
}

export default async function TransactionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const { id } = await params;

  const transaction = await prisma.transaction.findFirst({
    where: { tenantId: session.user.tenantId, id },
    include: {
      project: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
      fromAccount: { select: { id: true, name: true } },
      toAccount: { select: { id: true, name: true } },
      allocations: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!transaction) notFound();

  const invoiceIds = transaction.allocations
    .filter((allocation) => allocation.documentType === "CLIENT_INVOICE")
    .map((allocation) => allocation.documentId);
  const expenseIds = transaction.allocations
    .filter((allocation) => allocation.documentType === "EXPENSE")
    .map((allocation) => allocation.documentId);

  const [attachments, projects, accounts, categories, invoices, expenses] = await Promise.all([
    prisma.attachment.findMany({
      where: { tenantId: session.user.tenantId, entityType: "TRANSACTION", entityId: transaction.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.project.findMany({
      where: { tenantId: session.user.tenantId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.financeAccount.findMany({
      where: { tenantId: session.user.tenantId, active: true },
      orderBy: [{ type: "asc" }, { name: "asc" }],
      select: { id: true, name: true, type: true },
    }),
    prisma.txnCategory.findMany({
      where: { tenantId: session.user.tenantId, active: true },
      orderBy: [{ type: "asc" }, { name: "asc" }],
      select: { id: true, name: true, type: true },
    }),
    invoiceIds.length
      ? prisma.clientInvoice.findMany({
          where: { tenantId: session.user.tenantId, id: { in: invoiceIds } },
          select: { id: true, invoiceNumber: true },
        })
      : Promise.resolve([]),
    expenseIds.length
      ? prisma.expense.findMany({
          where: { tenantId: session.user.tenantId, id: { in: expenseIds } },
          select: { id: true, narration: true, expenseType: true },
        })
      : Promise.resolve([]),
  ]);

  const invoiceById = new Map(invoices.map((invoice) => [invoice.id, invoice]));
  const expenseById = new Map(expenses.map((expense) => [expense.id, expense]));
  const amount = Number(transaction.amount);
  const allocationGross = transaction.allocations.reduce((sum, allocation) => sum + Number(allocation.grossAmount), 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Transaction workspace</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {transaction.type} • {dateOnly(transaction.date)} • {transaction.project?.name ?? "No project"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/app/transactions">Back to ledger</Link>
          </Button>
        </div>
      </div>

      <section className="grid gap-4 lg:grid-cols-4">
        <MetricCard label="Amount" value={formatINR(amount)} />
        <MetricCard label="Category" value={transaction.category?.name ?? transaction.type} />
        <MetricCard label="Account path" value={accountFlowLabel(transaction.type, transaction.fromAccount?.name ?? null, transaction.toAccount?.name ?? null)} />
        <MetricCard label="Linked allocations" value={String(transaction.allocations.length)} />
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_360px] xl:items-start">
        <div className="space-y-6">
          <Card>
            <CardHeader className="border-b border-border/60">
              <CardTitle className="text-base">Review status</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <ApprovalStatusControl target="transaction" id={transaction.id} status={transaction.approvalStatus} showHelp />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b border-border/60">
              <CardTitle className="text-base">Edit transaction</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <TransactionEditForm
                transaction={{
                  id: transaction.id,
                  type: transaction.type,
                  date: dateOnly(transaction.date),
                  amount: transaction.amount.toString(),
                  projectId: transaction.projectId ?? "",
                  categoryId: transaction.categoryId ?? "",
                  fromAccountId: transaction.fromAccountId ?? "",
                  toAccountId: transaction.toAccountId ?? "",
                  note: transaction.note ?? "",
                  description: transaction.description ?? "",
                }}
                projects={projects}
                accounts={accounts}
                categories={categories}
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
              <DetailRow label="Project" value={transaction.project?.name ?? "Not linked"} />
              <DetailRow label="Category" value={transaction.category?.name ?? "Not linked"} />
              <DetailRow label="From" value={transaction.fromAccount?.name ?? "—"} />
              <DetailRow label="To" value={transaction.toAccount?.name ?? "—"} />
              <DetailRow label="Allocated gross" value={formatINR(allocationGross)} />
              <DetailRow label="Unallocated cash" value={formatINR(Math.max(0, amount - allocationGross))} />
              <DetailRow label="Internal note" value={transaction.note ?? "None"} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b border-border/60">
              <CardTitle className="text-base">Allocations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-6">
              {transaction.allocations.length === 0 ? (
                <InlineEmptyState
                  title="No allocations linked to this entry"
                  description="This transaction stands alone for now. Link allocations later if it needs invoice or expense settlement context."
                />
              ) : (
                transaction.allocations.map((allocation) => {
                  const invoice = invoiceById.get(allocation.documentId);
                  const expense = expenseById.get(allocation.documentId);
                  const href =
                    allocation.documentType === "CLIENT_INVOICE" && invoice
                      ? `/app/sales/invoices/${invoice.id}`
                      : expense
                        ? `/app/expenses/${expense.id}`
                        : null;

                  const title =
                    allocation.documentType === "CLIENT_INVOICE"
                      ? invoice?.invoiceNumber ?? allocation.documentId
                      : expense?.narration ?? expense?.expenseType ?? allocation.documentId;

                  const body = (
                    <div className="flex items-start justify-between gap-3 rounded-[18px] border border-border/60 bg-background/70 px-4 py-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{title}</div>
                        <div className="mt-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                          {allocation.documentType.replaceAll("_", " ")}
                        </div>
                      </div>
                      <div className="text-sm font-semibold tabular-nums">{formatINR(Number(allocation.grossAmount))}</div>
                    </div>
                  );

                  return href ? (
                    <Link key={allocation.id} href={href} className="block hover:opacity-90">
                      {body}
                    </Link>
                  ) : (
                    <div key={allocation.id}>{body}</div>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b border-border/60">
              <CardTitle className="text-base">Attachments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-6">
              {attachments.length === 0 ? (
                <InlineEmptyState
                  title="No attachments uploaded"
                  description="Add a supporting file when this entry needs reconciliation or audit backup."
                />
              ) : (
                attachments.map((attachment) => (
                  <div key={attachment.id} className="flex items-center justify-between gap-3 rounded-[18px] border border-border/60 bg-background/70 px-4 py-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{attachment.originalName}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{attachment.mimeType}</div>
                    </div>
                    <Button asChild size="sm" variant="outline">
                      <a href={`/api/attachments/${attachment.id}`} target="_blank" rel="noreferrer">
                        Open
                      </a>
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <ModuleCheatSheet moduleKey="transactions" variant="sidebar" showRoutingTrigger />
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
