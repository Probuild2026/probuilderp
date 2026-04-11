import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { Prisma } from "@prisma/client";

import { ApprovalStatusBadge } from "@/components/app/approval-status-badge";
import { ApprovalStatusGuide } from "@/components/app/approval-status-guide";
import { ExportLinks } from "@/components/app/export-links";
import { PageHeader } from "@/components/app/page-header";
import { EntryRoutingHelpModal } from "@/components/help/entry-routing-help-modal";
import { ModuleCheatSheet } from "@/components/help/module-cheat-sheet";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { approvalStatusLabels, approvalStatusValues, parseApprovalStatus } from "@/lib/approval-status";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { buildInclusiveDateRange, getSingleSearchParam, parseDateRangeParams } from "@/lib/date-range";
import { formatINR } from "@/lib/money";
import { getSelectedProjectId } from "@/lib/project-filter";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

type BillsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function BillsPage({ searchParams }: BillsPageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const sp = (await searchParams) ?? {};
  const q = getSingleSearchParam(sp, "q");
  const approval = parseApprovalStatus(getSingleSearchParam(sp, "approval"));
  const { from, to } = parseDateRangeParams(sp);
  const dateRange = buildInclusiveDateRange(from, to);

  const projectId = await getSelectedProjectId();
  const where: Prisma.PurchaseInvoiceWhereInput = {
    tenantId: session.user.tenantId,
    ...(projectId ? { projectId } : {}),
    ...(approval ? { approvalStatus: approval } : {}),
  };
  if (q) {
    where.OR = [
      { invoiceNumber: { contains: q, mode: "insensitive" } },
      { vendor: { name: { contains: q, mode: "insensitive" } } },
      { project: { name: { contains: q, mode: "insensitive" } } },
    ];
  }
  if (from || to) {
    where.invoiceDate = dateRange;
  }

  const bills = await prisma.purchaseInvoice.findMany({
    where,
    orderBy: [{ invoiceDate: "desc" }, { createdAt: "desc" }],
    take: 200,
    select: {
      id: true,
      invoiceNumber: true,
      invoiceDate: true,
      total: true,
      taxableValue: true,
      approvalStatus: true,
      vendor: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
    },
  });

  const paid = bills.length
    ? await prisma.transactionAllocation.groupBy({
        by: ["documentId"],
        where: {
          tenantId: session.user.tenantId,
          documentType: "PURCHASE_INVOICE",
          documentId: { in: bills.map((b) => b.id) },
        },
        _sum: { grossAmount: true },
      })
    : [];

  const paidById = new Map(paid.map((p) => [p.documentId, Number(p._sum.grossAmount ?? 0)]));

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <PageHeader
        title="Bills"
        description="Vendor bills (purchase invoices). Payments are tracked separately."
        action={{ label: "New Bill", href: "/app/purchases/bills/new" }}
        actions={<ExportLinks hrefBase="/api/exports/bills" params={{ q, from, to, approval }} />}
        actionSecondary={<EntryRoutingHelpModal />}
      />

      <ModuleCheatSheet moduleKey="bills" variant="compact" />

      <form className="grid gap-2 rounded-md border p-3 md:grid-cols-[1fr_auto_auto_auto_auto]" method="get">
        <Input
          name="q"
          defaultValue={q}
          placeholder="Search bill #, vendor, project…"
          className="md:max-w-xl"
        />
        <select
          name="approval"
          defaultValue={approval ?? ""}
          className="h-10 rounded-md border bg-background px-3 text-sm"
        >
          <option value="">All review statuses</option>
          {approvalStatusValues.map((status) => (
            <option key={status} value={status}>
              {approvalStatusLabels[status]}
            </option>
          ))}
        </select>
        <Input name="from" type="date" defaultValue={from} />
        <Input name="to" type="date" defaultValue={to} />
        <div className="flex gap-2">
          <Button type="submit">Apply</Button>
          <Button asChild variant="outline">
            <Link href="/app/purchases/bills">Reset</Link>
          </Button>
        </div>
      </form>

      <ApprovalStatusGuide />

      <Card>
        <CardContent className="p-0">
          <div className="overflow-auto">
          <Table className="min-w-[980px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[110px]">Date</TableHead>
                <TableHead>Bill #</TableHead>
                <TableHead className="w-[300px]">Vendor</TableHead>
                <TableHead className="hidden lg:table-cell">Project</TableHead>
                <TableHead className="hidden md:table-cell">Review</TableHead>
                <TableHead className="sticky right-[88px] z-20 bg-background text-right">Total</TableHead>
                <TableHead className="hidden sm:table-cell text-right">Paid</TableHead>
                <TableHead className="hidden md:table-cell text-right">Balance</TableHead>
                <TableHead className="sticky right-0 z-20 w-[88px] bg-background text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bills.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                    No bills yet.
                  </TableCell>
                </TableRow>
              ) : (
                bills.map((b) => {
                  const total = Number(b.total);
                  const paidGross = paidById.get(b.id) ?? 0;
                  const balance = Math.max(0, total - paidGross);
                  return (
                    <TableRow key={b.id}>
                      <TableCell className="whitespace-nowrap">{b.invoiceDate.toISOString().slice(0, 10)}</TableCell>
                      <TableCell className="font-medium">
                        <Link className="hover:underline" href={`/app/purchases/bills/${b.id}`}>
                          {b.invoiceNumber}
                        </Link>
                        <div className="mt-0.5 truncate text-xs text-muted-foreground lg:hidden">
                          {b.vendor.name} • {b.project.name} • {approvalStatusLabels[b.approvalStatus]}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[300px] truncate" title={b.vendor.name}>{b.vendor.name}</TableCell>
                      <TableCell className="hidden lg:table-cell max-w-[260px] truncate">{b.project.name}</TableCell>
                      <TableCell className="hidden md:table-cell"><ApprovalStatusBadge status={b.approvalStatus} /></TableCell>
                      <TableCell className="sticky right-[88px] z-10 whitespace-nowrap bg-background text-right tabular-nums">
                        {formatINR(total)}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell whitespace-nowrap text-right tabular-nums">{formatINR(paidGross)}</TableCell>
                      <TableCell className="hidden md:table-cell whitespace-nowrap text-right tabular-nums">{formatINR(balance)}</TableCell>
                      <TableCell className="sticky right-0 z-10 bg-background text-right">
                        <div className="flex justify-end gap-2">
                          <Button asChild size="sm" variant="secondary">
                            <Link href={`/app/purchases/bills/${b.id}`}>View</Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
