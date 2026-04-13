import Link from "next/link";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { notFound } from "next/navigation";

import { PartnerEntryForms } from "@/app/app/partners/[id]/partner-entry-forms";
import {
  PartnerDrawingRowActions,
  PartnerRemunerationRowActions,
  PartnerTdsPaymentRowActions,
} from "@/app/app/partners/[id]/partner-entry-row-actions";
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

const ALL_FY_VALUE = "all";
const ALL_FY_LABEL = "Till date";

function currentFy() {
  return getFinancialYear(new Date());
}

function normalizeFyParam(value: string | string[] | undefined) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function sortFinancialYearsDesc(financialYears: string[]) {
  return [...financialYears].sort((left, right) => right.localeCompare(left));
}

function financialYearDateRange(financialYear: string) {
  const match = financialYear.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;

  const startYear = Number(match[1]);
  if (!Number.isInteger(startYear)) return null;

  return {
    gte: new Date(startYear, 3, 1),
    lt: new Date(startYear + 1, 3, 1),
  };
}

function asNumber(v: Prisma.Decimal | null | undefined) {
  return Number(v ?? 0);
}

function asDateOnly(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : null;
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
  const requestedFy = normalizeFyParam(sp.fy);
  const currentFinancialYear = currentFy();

  const [remunerationYears, tdsPaymentYears, allocationYears] = await Promise.all([
    prisma.partnerRemuneration.findMany({
      where: { tenantId: session.user.tenantId, partnerId: id },
      distinct: ["fy"],
      select: { fy: true },
    }),
    prisma.partnerTdsPayment.findMany({
      where: { tenantId: session.user.tenantId, partnerId: id },
      distinct: ["fy"],
      select: { fy: true },
    }),
    prisma.projectProfitAllocation.findMany({
      where: { tenantId: session.user.tenantId },
      distinct: ["fy"],
      select: { fy: true },
    }),
  ]);

  const availableFinancialYears = sortFinancialYearsDesc(
    Array.from(
      new Set([
        currentFinancialYear,
        ...remunerationYears.map((row) => row.fy),
        ...tdsPaymentYears.map((row) => row.fy),
        ...allocationYears.map((row) => row.fy),
      ]),
    ),
  );
  const selectedFy =
    requestedFy === ALL_FY_VALUE || (requestedFy && availableFinancialYears.includes(requestedFy))
      ? requestedFy
      : currentFinancialYear;
  const fyLabel = selectedFy === ALL_FY_VALUE ? ALL_FY_LABEL : selectedFy;
  const pageDescription = selectedFy === ALL_FY_VALUE ? `Partner statement • ${ALL_FY_LABEL}` : `Partner statement • FY ${selectedFy}`;
  const entryFormFy = selectedFy === ALL_FY_VALUE ? currentFinancialYear : selectedFy;
  const drawingDateFilter =
    selectedFy && selectedFy !== ALL_FY_VALUE
      ? financialYearDateRange(selectedFy)
      : null;

  const [partner, remunerations, drawings, tdsPayments, allocations, projects] = await Promise.all([
    prisma.partner.findFirst({
      where: { id, tenantId: session.user.tenantId },
    }),
    prisma.partnerRemuneration.findMany({
      where: {
        tenantId: session.user.tenantId,
        partnerId: id,
        ...(selectedFy && selectedFy !== ALL_FY_VALUE ? { fy: selectedFy } : {}),
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 200,
      include: { project: { select: { name: true } } },
    }),
    prisma.partnerDrawing.findMany({
      where: {
        tenantId: session.user.tenantId,
        partnerId: id,
        ...(drawingDateFilter ? { date: drawingDateFilter } : {}),
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 200,
      include: { project: { select: { name: true } } },
    }),
    prisma.partnerTdsPayment.findMany({
      where: {
        tenantId: session.user.tenantId,
        partnerId: id,
        ...(selectedFy && selectedFy !== ALL_FY_VALUE ? { fy: selectedFy } : {}),
      },
      orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }],
      take: 200,
    }),
    prisma.projectProfitAllocation.findMany({
      where: {
        tenantId: session.user.tenantId,
        ...(selectedFy && selectedFy !== ALL_FY_VALUE ? { fy: selectedFy } : {}),
      },
      include: { project: { select: { name: true } } },
    }),
    prisma.project.findMany({
      where: { tenantId: session.user.tenantId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  if (!partner) notFound();

  const entryFormGrossFY = remunerations
    .filter((row) => row.fy === entryFormFy)
    .reduce((acc, row) => acc + asNumber(row.grossAmount), 0);
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
        description={pageDescription}
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
              <select
                name="fy"
                defaultValue={selectedFy ?? currentFinancialYear}
                className="h-10 min-w-40 rounded-md border bg-background px-3 text-sm"
              >
                <option value={ALL_FY_VALUE}>{ALL_FY_LABEL}</option>
                {availableFinancialYears.map((financialYear) => (
                  <option key={financialYear} value={financialYear}>
                    {financialYear}
                  </option>
                ))}
              </select>
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
            <CardTitle>TDS status ({fyLabel})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Line label="Deducted from remuneration" value={formatINR(remTds)} />
            <Line label="Deposited (challans)" value={formatINR(tdsPaid)} />
            <Line label="Pending deposit" value={formatINR(tdsPending)} />
          </CardContent>
        </Card>
      </div>

      {selectedFy === ALL_FY_VALUE ? (
        <div className="rounded-md border border-border/70 bg-card px-4 py-3 text-sm text-muted-foreground">
          Viewing {ALL_FY_LABEL.toLowerCase()} totals. New remuneration, TDS payment, and project allocation entries default to FY {entryFormFy}.
        </div>
      ) : null}

      <PartnerEntryForms partnerId={partner.id} fy={entryFormFy} projects={projects} existingGrossFY={entryFormGrossFY} />

      <Card>
        <CardHeader className="gap-2">
          <CardTitle>Remuneration entries ({fyLabel})</CardTitle>
          <p className="text-sm text-muted-foreground">
            Use Edit to fix wrong dates, amounts, project tags, or payment details. Use Delete only for accidental or duplicate rows. TDS is recalculated automatically after each change.
          </p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>FY</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Project</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right">TDS</TableHead>
                <TableHead className="text-right">Net</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>TDS status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {remunerations.map((row) => {
                const tdsAmount = asNumber(row.tdsAmount);
                const normalizedStatus = tdsAmount <= 0 ? "NOT_APPLICABLE" : row.tdsStatus;
                return (
                  <TableRow key={row.id}>
                    <TableCell>{asDateOnly(row.date)}</TableCell>
                    <TableCell>{row.fy}</TableCell>
                    <TableCell>{row.type}</TableCell>
                    <TableCell>{row.project?.name ?? "-"}</TableCell>
                    <TableCell className="text-right">{formatINR(asNumber(row.grossAmount))}</TableCell>
                    <TableCell className="text-right">{formatINR(tdsAmount)}</TableCell>
                    <TableCell className="text-right">{formatINR(asNumber(row.netPayable))}</TableCell>
                    <TableCell>
                      {row.paymentMode ? row.paymentMode : "UNPAID"}
                      {row.paymentDate ? ` • ${asDateOnly(row.paymentDate)}` : ""}
                    </TableCell>
                    <TableCell>{normalizedStatus}</TableCell>
                    <TableCell className="text-right">
                      <PartnerRemunerationRowActions
                        entry={{
                          id: row.id,
                          partnerId: row.partnerId,
                          projectId: row.projectId,
                          date: asDateOnly(row.date) ?? "",
                          type: row.type,
                          grossAmount: asNumber(row.grossAmount),
                          tdsRate: asNumber(row.tdsRate),
                          paymentMode: row.paymentMode,
                          paymentDate: asDateOnly(row.paymentDate),
                          note: row.note,
                        }}
                        projects={projects}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
              {remunerations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="py-8 text-center text-sm text-muted-foreground">
                    {selectedFy === ALL_FY_VALUE ? "No remuneration entries recorded." : "No remuneration entries for this FY."}
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="gap-2">
            <CardTitle>Drawings ({fyLabel})</CardTitle>
            <p className="text-sm text-muted-foreground">
              Edit if the amount or project tag was entered wrongly. Delete only rows that were created by mistake or duplicated.
            </p>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drawings.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{asDateOnly(row.date)}</TableCell>
                    <TableCell>{row.project?.name ?? "-"}</TableCell>
                    <TableCell>{row.mode}</TableCell>
                    <TableCell className="text-right">{formatINR(asNumber(row.amount))}</TableCell>
                    <TableCell className="text-right">
                      <PartnerDrawingRowActions
                        entry={{
                          id: row.id,
                          partnerId: row.partnerId,
                          projectId: row.projectId,
                          date: asDateOnly(row.date) ?? "",
                          amount: asNumber(row.amount),
                          mode: row.mode,
                          note: row.note,
                        }}
                        projects={projects}
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {drawings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                      {selectedFy === ALL_FY_VALUE ? "No drawings recorded." : "No drawings recorded for this FY."}
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="gap-2">
            <CardTitle>TDS payments ({fyLabel})</CardTitle>
            <p className="text-sm text-muted-foreground">
              Edit challan details, dates, or amounts if they were typed wrongly. Delete only duplicate or accidental rows.
            </p>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Payment date</TableHead>
                  <TableHead>FY</TableHead>
                  <TableHead>Section</TableHead>
                  <TableHead>Challan</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tdsPayments.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{asDateOnly(row.paymentDate)}</TableCell>
                    <TableCell>{row.fy}</TableCell>
                    <TableCell>{row.section}</TableCell>
                    <TableCell>{row.challanNo || "-"}</TableCell>
                    <TableCell className="text-right">{formatINR(asNumber(row.tdsPaidAmount))}</TableCell>
                    <TableCell className="text-right">
                      <PartnerTdsPaymentRowActions
                        entry={{
                          id: row.id,
                          partnerId: row.partnerId,
                          fy: row.fy,
                          section: row.section,
                          challanNo: row.challanNo,
                          periodFrom: asDateOnly(row.periodFrom),
                          periodTo: asDateOnly(row.periodTo),
                          tdsPaidAmount: asNumber(row.tdsPaidAmount),
                          paymentDate: asDateOnly(row.paymentDate) ?? "",
                          note: row.note,
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {tdsPayments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                      {selectedFy === ALL_FY_VALUE ? "No TDS payments recorded." : "No TDS payments recorded for this FY."}
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
