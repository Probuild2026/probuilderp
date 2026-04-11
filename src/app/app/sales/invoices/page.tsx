import Link from "next/link";
import { getServerSession } from "next-auth/next";

import { ExportLinks } from "@/components/app/export-links";
import { PageHeader } from "@/components/app/page-header";
import { EntryRoutingHelpModal } from "@/components/help/entry-routing-help-modal";
import { ModuleCheatSheet } from "@/components/help/module-cheat-sheet";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { buildInclusiveDateRange, parseDateRangeParams } from "@/lib/date-range";
import { formatINR } from "@/lib/money";
import { getSelectedProjectId } from "@/lib/project-filter";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

function statusFromSettled(total: number, settled: number) {
  if (settled >= total) return "PAID";
  if (settled > 0) return "PARTIAL";
  return "DUE";
}

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const sp = (await searchParams) ?? {};
  const { from, to } = parseDateRangeParams(sp);
  const dateRange = buildInclusiveDateRange(from, to);
  const projectId = await getSelectedProjectId();

  const invoices = await prisma.clientInvoice.findMany({
    where: {
      tenantId: session.user.tenantId,
      ...(projectId ? { projectId } : {}),
      ...(dateRange ? { invoiceDate: dateRange } : {}),
    },
    orderBy: [{ invoiceDate: "desc" }, { createdAt: "desc" }],
    take: 200,
    select: {
      id: true,
      invoiceNumber: true,
      invoiceDate: true,
      total: true,
      basicValue: true,
      project: { select: { name: true } },
      client: { select: { name: true } },
    },
  });

  const invoiceIds = invoices.map((i) => i.id);
  const allocs =
    invoiceIds.length === 0
      ? []
      : await prisma.transactionAllocation.groupBy({
          by: ["documentId"],
          where: {
            tenantId: session.user.tenantId,
            documentType: "CLIENT_INVOICE",
            documentId: { in: invoiceIds },
          },
          _sum: { cashAmount: true, tdsAmount: true, grossAmount: true },
        });
  const byInvoiceId = new Map(
    allocs.map((a) => [
      a.documentId,
      {
        cash: Number(a._sum.cashAmount ?? 0),
        tds: Number(a._sum.tdsAmount ?? 0),
        gross: Number(a._sum.grossAmount ?? 0),
      },
    ]),
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <PageHeader
        title="Invoices"
        description="Create GST invoices and track receipts + TDS."
        action={{ label: "New invoice", href: "/app/sales/invoices/new" }}
        actions={<ExportLinks hrefBase="/api/exports/invoices" params={{ from, to }} />}
        actionSecondary={<EntryRoutingHelpModal />}
      />

      <ModuleCheatSheet moduleKey="invoices" variant="compact" />

      <form className="grid gap-2 rounded-md border p-3 md:grid-cols-[auto_auto_auto]" method="get">
        <Input name="from" type="date" defaultValue={from} />
        <Input name="to" type="date" defaultValue={to} />
        <div className="flex gap-2">
          <Button type="submit">Apply</Button>
          <Button asChild variant="outline">
            <Link href="/app/sales/invoices">Reset</Link>
          </Button>
        </div>
      </form>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead className="text-right">Basic</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Received</TableHead>
                  <TableHead className="text-right">TDS</TableHead>
                  <TableHead className="text-right">Settled</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Open</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="py-10 text-center text-sm text-muted-foreground">
                      No invoices yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  invoices.map((inv) => (
                    (() => {
                      const a = byInvoiceId.get(inv.id) ?? { cash: 0, tds: 0, gross: 0 };
                      const status = statusFromSettled(Number(inv.total), a.gross);
                      return (
                    <TableRow key={inv.id}>
                      <TableCell>{inv.invoiceDate.toISOString().slice(0, 10)}</TableCell>
                      <TableCell className="font-medium">{inv.invoiceNumber}</TableCell>
                      <TableCell className="max-w-[260px] truncate">{inv.project.name}</TableCell>
                      <TableCell className="max-w-[260px] truncate">{inv.client.name}</TableCell>
                      <TableCell className="text-right">{formatINR(Number(inv.basicValue))}</TableCell>
                      <TableCell className="text-right">{formatINR(Number(inv.total))}</TableCell>
                      <TableCell className="text-right">{formatINR(a.cash)}</TableCell>
                      <TableCell className="text-right">{formatINR(a.tds)}</TableCell>
                      <TableCell className="text-right">{formatINR(a.gross)}</TableCell>
                      <TableCell>{status}</TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/app/sales/invoices/${inv.id}`}>View</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                      );
                    })()
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
