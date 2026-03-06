import Link from "next/link";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { notFound } from "next/navigation";

import { PartnerEntryForms } from "@/app/app/partners/[id]/partner-entry-forms";
import { EditPartnerDialog } from "@/app/app/partners/partner-dialog";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getFinancialYear } from "@/lib/partner-finance";
import { formatINR } from "@/lib/money";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

function currentFy() {
  return getFinancialYear(new Date());
}

function asNumber(v: Prisma.Decimal | null | undefined) {
  return Number(v ?? 0);
}

export default async function PartnerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const { id } = await params;
  const sp = (await searchParams) ?? {};
  const fy = typeof sp.fy === "string" && sp.fy.trim() ? sp.fy.trim() : currentFy();

  const [partner, remunerations, drawings, tdsPayments, allocations, projects] = await Promise.all([
    prisma.partner.findFirst({
      where: { id, tenantId: session.user.tenantId },
    }),
    prisma.partnerRemuneration.findMany({
      where: { tenantId: session.user.tenantId, partnerId: id, fy },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 200,
      include: { project: { select: { name: true } } },
    }),
    prisma.partnerDrawing.findMany({
      where: { tenantId: session.user.tenantId, partnerId: id },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 200,
      include: { project: { select: { name: true } } },
    }),
    prisma.partnerTdsPayment.findMany({
      where: { tenantId: session.user.tenantId, partnerId: id, fy },
      orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }],
      take: 200,
    }),
    prisma.projectProfitAllocation.findMany({
      where: { tenantId: session.user.tenantId, fy },
      include: { project: { select: { name: true } } },
    }),
    prisma.project.findMany({
      where: { tenantId: session.user.tenantId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  if (!partner) notFound();

  const remGross = remunerations.reduce((acc, row) => acc + asNumber(row.grossAmount), 0);
  const remTds = remunerations.reduce((acc, row) => acc + asNumber(row.tdsAmount), 0);
  const remNet = remunerations.reduce((acc, row) => acc + asNumber(row.netPayable), 0);
  const drawingsTotal = drawings.reduce((acc, row) => acc + asNumber(row.amount), 0);
  const tdsPaid = tdsPayments.reduce((acc, row) => acc + asNumber(row.tdsPaidAmount), 0);
  const tdsPending = Math.max(0, remTds - tdsPaid);
  const profitShare = allocations.reduce(
    (acc, row) => acc + (asNumber(row.profitAfterRemu) * asNumber(partner.profitRatio)) / 100,
    0,
  );
  const profitBalance = profitShare - drawingsTotal;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <PageHeader
        title={partner.name}
        description={`Partner statement • FY ${fy}`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link href="/app/partners">Back</Link>
            </Button>
            <EditPartnerDialog
              partner={{
                id: partner.id,
                name: partner.name,
                pan: partner.pan,
                profitRatio: asNumber(partner.profitRatio),
                capitalContribution: partner.capitalContribution ? asNumber(partner.capitalContribution) : null,
                isActive: partner.isActive,
                notes: partner.notes,
              }}
            />
          </div>
        }
        filters={
          <form className="flex items-end gap-2" method="get">
            <div>
              <label className="text-xs text-muted-foreground">Financial year</label>
              <input
                name="fy"
                defaultValue={fy}
                className="h-10 w-32 rounded-md border bg-background px-3 text-sm"
                placeholder="2025-26"
              />
            </div>
            <Button type="submit" variant="outline">
              Apply
            </Button>
          </form>
        }
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Remuneration (gross)" value={formatINR(remGross)} />
        <MetricCard label="TDS deducted / pending" value={`${formatINR(remTds)} / ${formatINR(tdsPending)}`} />
        <MetricCard label="Drawings" value={formatINR(drawingsTotal)} />
        <MetricCard label="Profit share balance" value={formatINR(profitBalance)} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Line label="PAN" value={partner.pan || "-"} />
            <Line label="Profit ratio" value={`${asNumber(partner.profitRatio).toFixed(2)}%`} />
            <Line label="Capital contribution" value={formatINR(asNumber(partner.capitalContribution))} />
            <Line label="Net remuneration paid/owed" value={formatINR(remNet)} />
            <Line label="TDS paid to govt" value={formatINR(tdsPaid)} />
            <Line label="Profit share allocated" value={formatINR(profitShare)} />
            <Line label="Drawings adjusted" value={formatINR(drawingsTotal)} />
            <Line label="Balance due" value={formatINR(profitBalance)} />
            <div className="pt-2">
              {partner.isActive ? <Badge>Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>TDS status ({fy})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Line label="Deducted from remuneration" value={formatINR(remTds)} />
            <Line label="Deposited (challans)" value={formatINR(tdsPaid)} />
            <Line label="Pending deposit" value={formatINR(tdsPending)} />
          </CardContent>
        </Card>
      </div>

      <PartnerEntryForms partnerId={partner.id} fy={fy} projects={projects} existingGrossFY={remGross} />

      <Card>
        <CardHeader>
          <CardTitle>Remuneration entries ({fy})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Project</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right">TDS</TableHead>
                <TableHead className="text-right">Net</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>TDS status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {remunerations.map((row) => {
                const tdsAmount = asNumber(row.tdsAmount);
                const normalizedStatus = tdsAmount <= 0 ? "NOT_APPLICABLE" : row.tdsStatus;
                return (
                  <TableRow key={row.id}>
                    <TableCell>{row.date.toISOString().slice(0, 10)}</TableCell>
                    <TableCell>{row.type}</TableCell>
                    <TableCell>{row.project?.name ?? "-"}</TableCell>
                    <TableCell className="text-right">{formatINR(asNumber(row.grossAmount))}</TableCell>
                    <TableCell className="text-right">{formatINR(tdsAmount)}</TableCell>
                    <TableCell className="text-right">{formatINR(asNumber(row.netPayable))}</TableCell>
                    <TableCell>
                      {row.paymentMode ? row.paymentMode : "UNPAID"}
                      {row.paymentDate ? ` • ${row.paymentDate.toISOString().slice(0, 10)}` : ""}
                    </TableCell>
                    <TableCell>{normalizedStatus}</TableCell>
                  </TableRow>
                );
              })}
              {remunerations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                    No remuneration entries for this FY.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Drawings</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drawings.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.date.toISOString().slice(0, 10)}</TableCell>
                    <TableCell>{row.project?.name ?? "-"}</TableCell>
                    <TableCell>{row.mode}</TableCell>
                    <TableCell className="text-right">{formatINR(asNumber(row.amount))}</TableCell>
                  </TableRow>
                ))}
                {drawings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                      No drawings recorded.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>TDS payments ({fy})</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Payment date</TableHead>
                  <TableHead>Section</TableHead>
                  <TableHead>Challan</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tdsPayments.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.paymentDate.toISOString().slice(0, 10)}</TableCell>
                    <TableCell>{row.section}</TableCell>
                    <TableCell>{row.challanNo || "-"}</TableCell>
                    <TableCell className="text-right">{formatINR(asNumber(row.tdsPaidAmount))}</TableCell>
                  </TableRow>
                ))}
                {tdsPayments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                      No TDS payments recorded for this FY.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
