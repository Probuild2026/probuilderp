import Link from "next/link";
import { getServerSession } from "next-auth/next";

import { Button } from "@/components/ui/button";
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
    <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">New Transaction</h1>
          <p className="mt-1 text-sm text-muted-foreground">Quick entry like your phone tracker.</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/app/transactions">Back</Link>
        </Button>
      </div>

      <TransactionForm today={today} projects={projects} accounts={accounts} categories={categories} />
    </div>
  );
}

