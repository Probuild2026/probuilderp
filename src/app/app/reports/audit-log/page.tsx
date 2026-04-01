import Link from "next/link";
import { getServerSession } from "next-auth/next";

import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { buildInclusiveDateRange, getSingleSearchParam, parseDateRangeParams } from "@/lib/date-range";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

const actionOptions = ["CREATE", "UPDATE", "DELETE", "STATUS_CHANGED", "EXPORT"] as const;
const entityOptions = [
  "BILL",
  "EXPENSE",
  "WAGE_SHEET",
  "PAYMENT_MADE",
  "RECEIPT",
  "TRANSACTIONS",
  "EXPENSES",
  "WAGES",
  "RECEIPTS",
  "INVOICES",
  "PAYMENTS-MADE",
  "BILLS",
  "AGING_RECEIVABLES",
  "AGING_PAYABLES",
  "LEDGER_CLIENT",
  "LEDGER_VENDOR",
  "GST_PURCHASE_REGISTER",
  "GST_SALES_REGISTER",
  "TDS_DASHBOARD",
  "MONTHLY_OUTFLOW",
] as const;

function dateTime(value: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(value);
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const sp = (await searchParams) ?? {};
  const action = getSingleSearchParam(sp, "action");
  const entityType = getSingleSearchParam(sp, "entityType");
  const { from, to } = parseDateRangeParams(sp);
  const dateRange = buildInclusiveDateRange(from, to);

  const logs = await prisma.auditLog.findMany({
    where: {
      tenantId: session.user.tenantId,
      ...(action ? { action } : {}),
      ...(entityType ? { entityType } : {}),
      ...(dateRange ? { createdAt: dateRange } : {}),
    },
    orderBy: [{ createdAt: "desc" }],
    take: 200,
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <PageHeader
        title="Audit Log"
        description="Use this screen to see who created, changed, deleted, exported, or reclassified records."
      />

      <Card>
        <CardHeader>
          <CardTitle>How to Use This Screen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <div>1. If something looks wrong, filter by date first, then look at the latest change.</div>
          <div>2. `Summary` tells you what happened in plain language.</div>
          <div>3. `Metadata` keeps the supporting details like amount, mode, or invoice id.</div>
        </CardContent>
      </Card>

      <form className="grid gap-2 rounded-md border p-3 md:grid-cols-[auto_auto_auto_auto_auto]" method="get">
        <select name="action" defaultValue={action} className="h-10 rounded-md border bg-background px-3 text-sm">
          <option value="">All actions</option>
          {actionOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <select name="entityType" defaultValue={entityType} className="h-10 rounded-md border bg-background px-3 text-sm">
          <option value="">All record types</option>
          {entityOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <Input name="from" type="date" defaultValue={from} />
        <Input name="to" type="date" defaultValue={to} />
        <div className="flex gap-2">
          <Button type="submit">Apply</Button>
          <Button asChild variant="outline">
            <Link href="/app/reports/audit-log">Reset</Link>
          </Button>
        </div>
      </form>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Summary</TableHead>
                  <TableHead>Metadata</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                      No audit entries found for the selected filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap">{dateTime(log.createdAt)}</TableCell>
                      <TableCell>{log.userEmail ?? log.userId ?? "Unknown user"}</TableCell>
                      <TableCell>{log.action}</TableCell>
                      <TableCell>{log.entityType}</TableCell>
                      <TableCell className="min-w-[280px]">{log.summary}</TableCell>
                      <TableCell className="max-w-[320px] whitespace-pre-wrap break-words text-xs text-muted-foreground">
                        {log.metadata ? JSON.stringify(log.metadata) : "-"}
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
