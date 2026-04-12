import Link from "next/link";
import { getServerSession } from "next-auth/next";

import { ModuleCheatSheet } from "@/components/help/module-cheat-sheet";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

import { TransactionForm } from "./transaction-form";

export default async function NewTransactionPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const [projects, accounts, categories] = await Promise.all([
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
  ]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">New transaction</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Capture cashbook movements quickly when the full bill, invoice, or receipt workflows are not the right fit.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/app/transactions">Back</Link>
        </Button>
      </div>

      <section className="grid gap-4 lg:grid-cols-3">
        <MetricCard label="Projects available" value={String(projects.length)} />
        <MetricCard label="Accounts available" value={String(accounts.length)} />
        <MetricCard label="Categories available" value={String(categories.length)} />
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_360px] xl:items-start">
        <div className="space-y-6">
          <TransactionForm
            tenantId={session.user.tenantId}
            today={today}
            projects={projects}
            accounts={accounts}
            categories={categories}
          />
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader className="border-b border-border/60">
              <CardTitle className="text-base">Entry guidance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-6 text-sm text-muted-foreground">
              <p>Use Transactions for generic income, expense, and transfer entries that do not need a richer document lifecycle.</p>
              <p>Choose Income or Expense when a single account is affected. Use Transfer only when cash moves between two internal accounts.</p>
              <p>Attach a supporting file when this entry needs reconciliation backup later.</p>
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
      <CardContent className="text-lg font-semibold">{value}</CardContent>
    </Card>
  );
}
