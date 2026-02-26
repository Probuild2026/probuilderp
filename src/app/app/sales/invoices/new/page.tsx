import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";

import { Button } from "@/components/ui/button";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

import { InvoiceForm } from "../ui/invoice-form";
import { createClientInvoice } from "../actions";

export default async function NewInvoicePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const [projects, clients] = await Promise.all([
    prisma.project.findMany({
      where: { tenantId: session.user.tenantId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.client.findMany({
      where: { tenantId: session.user.tenantId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">New Invoice</h1>
          <p className="mt-1 text-sm text-muted-foreground">GST invoice (single service / stage billing for now).</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/app/sales/invoices">Back</Link>
        </Button>
      </div>

      <InvoiceForm
        today={today}
        projects={projects}
        clients={clients}
        submitLabel="Create invoice"
        onSubmit={async (fd) => {
          "use server";
          const id = await createClientInvoice(fd);
          redirect(`/app/sales/invoices/${id}`);
        }}
      />
    </div>
  );
}

