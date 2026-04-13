import Link from "next/link";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { BriefcaseBusiness, Landmark, ShieldCheck, UsersRound } from "lucide-react";

import { AddPartnerDialog, EditPartnerDialog } from "@/app/app/partners/partner-dialog";
import { PageHeader } from "@/components/app/page-header";
import { StatePanel, TableEmptyState } from "@/components/app/state-panels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PARTNER_TDS_THRESHOLD, getFinancialYear } from "@/lib/partner-finance";
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

function isMissingTableError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2021" || error.code === "P2022");
}

function isDbUnavailableError(error: unknown) {
  return (
    (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P1001") ||
    (error instanceof Error && error.message.includes("Can't reach database server"))
  );
}

export default async function PartnersPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const sp = (await searchParams) ?? {};
  const requestedFy = normalizeFyParam(sp.fy);
  const currentFinancialYear = currentFy();

  try {
    const partners = await prisma.partner.findMany({
      where: { tenantId: session.user.tenantId },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        pan: true,
        profitRatio: true,
        capitalContribution: true,
        isActive: true,
        notes: true,
      },
    });

    const [remunerationYears, tdsPaymentYears] = await Promise.all([
      prisma.partnerRemuneration.findMany({
        where: { tenantId: session.user.tenantId },
        distinct: ["fy"],
        select: { fy: true },
      }),
      prisma.partnerTdsPayment.findMany({
        where: { tenantId: session.user.tenantId },
        distinct: ["fy"],
        select: { fy: true },
      }),
    ]);

    const availableFinancialYears = sortFinancialYearsDesc(
      Array.from(new Set([currentFinancialYear, ...remunerationYears.map((row) => row.fy), ...tdsPaymentYears.map((row) => row.fy)])),
    );
    const selectedFy =
      requestedFy === ALL_FY_VALUE || (requestedFy && availableFinancialYears.includes(requestedFy))
        ? requestedFy
        : currentFinancialYear;
    const fyLabel = selectedFy === ALL_FY_VALUE ? ALL_FY_LABEL : selectedFy;
    const detailFy = selectedFy === ALL_FY_VALUE ? currentFinancialYear : selectedFy;

    const [remuAgg, drawingsAgg, tdsAgg] = await Promise.all([
      prisma.partnerRemuneration.groupBy({
        by: ["partnerId"],
        where: {
          tenantId: session.user.tenantId,
          ...(selectedFy && selectedFy !== ALL_FY_VALUE ? { fy: selectedFy } : {}),
        },
        _sum: { grossAmount: true, tdsAmount: true },
      }),
      prisma.partnerDrawing.groupBy({
        by: ["partnerId"],
        where: { tenantId: session.user.tenantId },
        _sum: { amount: true },
      }),
      prisma.partnerTdsPayment.groupBy({
        by: ["partnerId"],
        where: {
          tenantId: session.user.tenantId,
          ...(selectedFy && selectedFy !== ALL_FY_VALUE ? { fy: selectedFy } : {}),
        },
        _sum: { tdsPaidAmount: true },
      }),
    ]);

    const remuMap = new Map(remuAgg.map((r) => [r.partnerId, { gross: Number(r._sum.grossAmount ?? 0), tds: Number(r._sum.tdsAmount ?? 0) }]));
    const drawingsMap = new Map(drawingsAgg.map((r) => [r.partnerId, Number(r._sum.amount ?? 0)]));
    const tdsPaidMap = new Map(tdsAgg.map((r) => [r.partnerId, Number(r._sum.tdsPaidAmount ?? 0)]));

    return (
      <div className="mx-auto max-w-[1440px] space-y-6 p-4 md:p-6">
        <PageHeader
          eyebrow="Workforce / Partners"
          title="Partners"
          description="Track partner remuneration, drawings, and 194T TDS lifecycle."
          actions={<AddPartnerDialog />}
          filters={
            <form method="get" className="flex items-end gap-2">
              <div>
                <label className="text-xs text-muted-foreground">Financial year</label>
                <select
                  name="fy"
                  defaultValue={selectedFy ?? currentFinancialYear}
                  className="h-10 min-w-40 rounded-xl border border-border/80 bg-background/80 px-3 text-sm shadow-sm"
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

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            icon={UsersRound}
            label="Partners"
            value={String(partners.length)}
          />
          <SummaryCard
            icon={BriefcaseBusiness}
            label={`Total remuneration (${fyLabel})`}
            value={formatINR(partners.reduce((acc, p) => acc + (remuMap.get(p.id)?.gross ?? 0), 0))}
          />
          <SummaryCard
            icon={ShieldCheck}
            label={`TDS deducted (${fyLabel})`}
            value={formatINR(partners.reduce((acc, p) => acc + (remuMap.get(p.id)?.tds ?? 0), 0))}
          />
          <SummaryCard
            icon={Landmark}
            label={`TDS pending (${fyLabel})`}
            value={formatINR(
              partners.reduce((acc, p) => {
                const deducted = remuMap.get(p.id)?.tds ?? 0;
                const paid = tdsPaidMap.get(p.id) ?? 0;
                return acc + Math.max(0, deducted - paid);
              }, 0),
            )}
          />
        </div>

        <Card>
          <CardHeader className="border-b border-border/60">
            <CardTitle className="text-base">Partner register</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Partner</TableHead>
                <TableHead>PAN</TableHead>
                <TableHead className="text-right">Ratio %</TableHead>
                <TableHead className="text-right">Remuneration ({fyLabel})</TableHead>
                <TableHead className="text-right">Drawings</TableHead>
                <TableHead className="text-right">TDS pending</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {partners.map((partner) => {
                const gross = remuMap.get(partner.id)?.gross ?? 0;
                const tdsDeducted = remuMap.get(partner.id)?.tds ?? 0;
                const tdsPaid = tdsPaidMap.get(partner.id) ?? 0;
                const tdsPending = Math.max(0, tdsDeducted - tdsPaid);
                const isThresholdHit = gross > PARTNER_TDS_THRESHOLD;

                return (
                  <TableRow key={partner.id}>
                    <TableCell className="font-medium">
                      <Link className="hover:underline" href={`/app/partners/${partner.id}?fy=${encodeURIComponent(detailFy)}`}>
                        {partner.name}
                      </Link>
                    </TableCell>
                    <TableCell>{partner.pan || "-"}</TableCell>
                    <TableCell className="text-right">{Number(partner.profitRatio).toFixed(2)}</TableCell>
                    <TableCell className="text-right">{formatINR(gross)}</TableCell>
                    <TableCell className="text-right">{formatINR(drawingsMap.get(partner.id) ?? 0)}</TableCell>
                    <TableCell className="text-right">{formatINR(tdsPending)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        {partner.isActive ? <Badge>Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
                        {isThresholdHit ? <Badge variant="outline">194T active</Badge> : <Badge variant="outline">Below threshold</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <EditPartnerDialog
                          partner={{
                            id: partner.id,
                            name: partner.name,
                            pan: partner.pan,
                            profitRatio: Number(partner.profitRatio),
                            capitalContribution: partner.capitalContribution ? Number(partner.capitalContribution) : null,
                            isActive: partner.isActive,
                            notes: partner.notes,
                          }}
                        />
                        <Button size="sm" asChild>
                          <Link href={`/app/partners/${partner.id}?fy=${encodeURIComponent(detailFy)}`}>View</Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {partners.length === 0 ? (
                <TableEmptyState
                  colSpan={8}
                  title="No partners yet"
                  description="Add partner master data to start tracking remuneration, drawings, and 194T obligations."
                />
              ) : null}
            </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  } catch (error) {
    if (!isMissingTableError(error) && !isDbUnavailableError(error)) throw error;
    return (
      <div className="mx-auto max-w-4xl space-y-4 p-4 md:p-6">
        <PageHeader
          eyebrow="Workforce / Partners"
          title="Partners"
          description={isDbUnavailableError(error) ? "Database temporarily unreachable for the partner module." : "Database update required for partner module."}
        />
        {isDbUnavailableError(error) ? (
          <StatePanel
            tone="warning"
            title="Database temporarily unreachable"
            description="The app could not connect to the database. Check DATABASE_URL or Prisma Postgres availability and refresh."
          />
        ) : (
          <div className="rounded-[24px] border border-border/70 bg-card p-4 text-sm">
            <div className="font-medium">Run Prisma migration</div>
            <pre className="mt-3 overflow-x-auto rounded-xl bg-black/40 p-3 text-xs">
{`cd "/Users/roshanvinayan/Documents/Probuild ERP/probuild-erp"
npx prisma migrate deploy`}
            </pre>
          </div>
        )}
      </div>
    );
  }
}

function SummaryCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 pt-6">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
          <div className="mt-3 text-2xl font-semibold tracking-tight">{value}</div>
        </div>
        <div className="flex size-11 items-center justify-center rounded-2xl bg-accent/60 text-accent-foreground">
          <Icon className="size-4" />
        </div>
      </CardContent>
    </Card>
  );
}
