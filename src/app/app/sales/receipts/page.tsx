import Link from "next/link";
import { getServerSession } from "next-auth/next";

import { ApprovalStatusBadge } from "@/components/app/approval-status-badge";
import { ApprovalStatusGuide } from "@/components/app/approval-status-guide";
import { ExportLinks } from "@/components/app/export-links";
import { PageHeader } from "@/components/app/page-header";
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

import { deleteReceipt } from "./actions";

export default async function ReceiptsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const sp = (await searchParams) ?? {};
  const approval = parseApprovalStatus(getSingleSearchParam(sp, "approval"));
  const { from, to } = parseDateRangeParams(sp);
  const dateRange = buildInclusiveDateRange(from, to);
  const projectId = await getSelectedProjectId();

  const receipts = await prisma.receipt.findMany({
    where: {
      tenantId: session.user.tenantId,
      ...(projectId ? { clientInvoice: { projectId } } : {}),
      ...(dateRange ? { date: dateRange } : {}),
      ...(approval ? { approvalStatus: approval } : {}),
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 200,
    select: {
      id: true,
      date: true,
      amountReceived: true,
      mode: true,
      tdsAmount: true,
      approvalStatus: true,
      clientInvoice: {
        select: {
          id: true,
          invoiceNumber: true,
          project: { select: { name: true } },
          client: { select: { name: true } },
        },
      },
    },
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <PageHeader
        title="Receipts"
        description="Payments received against invoices (including TDS)."
        action={{ label: "New receipt", href: "/app/sales/receipts/new" }}
        actions={
          <>
            <ExportLinks hrefBase="/api/exports/receipts" params={{ from, to, approval }} />
            <Button asChild variant="outline">
              <Link href="/app/sales/invoices">Go to invoices</Link>
            </Button>
          </>
        }
      />

      <form className="grid gap-2 rounded-md border p-3 md:grid-cols-[auto_auto_auto_auto]" method="get">
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
            <Link href="/app/sales/receipts">Reset</Link>
          </Button>
        </div>
      </form>

      <ApprovalStatusGuide />

      <Card>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Invoice #</TableHead>
                  <TableHead className="hidden md:table-cell">Project</TableHead>
                  <TableHead className="hidden md:table-cell">Client</TableHead>
                  <TableHead className="text-right">Received</TableHead>
                  <TableHead className="text-right">TDS</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead className="hidden md:table-cell">Review</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receipts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                      No receipts yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  receipts.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.date.toISOString().slice(0, 10)}</TableCell>
                      <TableCell className="font-medium">
                        <Link className="hover:underline" href={`/app/sales/receipts/${r.id}`}>
                          {r.clientInvoice.invoiceNumber}
                        </Link>
                      </TableCell>
                      <TableCell className="hidden max-w-[260px] truncate md:table-cell">{r.clientInvoice.project.name}</TableCell>
                      <TableCell className="hidden max-w-[260px] truncate md:table-cell">{r.clientInvoice.client.name}</TableCell>
                      <TableCell className="text-right">{formatINR(Number(r.amountReceived))}</TableCell>
                      <TableCell className="text-right">{formatINR(Number(r.tdsAmount ?? 0))}</TableCell>
                      <TableCell>{r.mode}</TableCell>
                      <TableCell className="hidden md:table-cell"><ApprovalStatusBadge status={r.approvalStatus} /></TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button asChild variant="secondary" size="sm">
                            <Link href={`/app/sales/receipts/${r.id}`}>View</Link>
                          </Button>
                          <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
                            <Link href={`/app/sales/invoices/${r.clientInvoice.id}`}>Invoice</Link>
                          </Button>
                          <form
                            action={async () => {
                              "use server";
                              await deleteReceipt(r.id, r.clientInvoice.id);
                            }}
                          >
                            <Button variant="destructive" size="sm" type="submit">
                              Delete
                            </Button>
                          </form>
                        </div>
                      </TableCell>
                    </TableRow>
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
