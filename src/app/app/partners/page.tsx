import Link from "next/link";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { BriefcaseBusiness, Landmark, ShieldCheck, UsersRound } from "lucide-react";

import { AddPartnerDialog, EditPartnerDialog } from "@/app/app/partners/partner-dialog";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PARTNER_TDS_THRESHOLD, getFinancialYear } from "@/lib/partner-finance";
import { formatINR } from "@/lib/money";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

function currentFy() {
  return getFinancialYear(new Date());
}

function isMissingTableError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2021" || error.code === "P2022");
}

export default async function PartnersPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const sp = (await searchParams) ?? {};
  const fy = typeof sp.fy === "string" && sp.fy.trim() ? sp.fy.trim() : currentFy();

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

    const [remuAgg, drawingsAgg, tdsAgg] = await Promise.all([
      prisma.partnerRemuneration.groupBy({
        by: ["partnerId"],
        where: { tenantId: session.user.tenantId, fy },
        _sum: { grossAmount: true, tdsAmount: true },
      }),
      prisma.partnerDrawing.groupBy({
        by: ["partnerId"],
        where: { tenantId: session.user.tenantId },
        _sum: { amount: true },
      }),
      prisma.partnerTdsPayment.groupBy({
        by: ["partnerId"],
        where: { tenantId: session.user.tenantId, fy },
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
                <input
                  name="fy"
                  defaultValue={fy}
                  className="h-10 w-32 rounded-xl border border-border/80 bg-background/80 px-3 text-sm shadow-sm"
                  placeholder="2025-26"
                />
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
            label={`Total remuneration (${fy})`}
            value={formatINR(partners.reduce((acc, p) => acc + (remuMap.get(p.id)?.gross ?? 0), 0))}
          />
          <SummaryCard
            icon={ShieldCheck}
            label={`TDS deducted (${fy})`}
            value={formatINR(partners.reduce((acc, p) => acc + (remuMap.get(p.id)?.tds ?? 0), 0))}
          />
          <SummaryCard
            icon={Landmark}
            label={`TDS pending (${fy})`}
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
                <TableHead className="text-right">Remuneration ({fy})</TableHead>
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
                      <Link className="hover:underline" href={`/app/partners/${partner.id}?fy=${encodeURIComponent(fy)}`}>
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
                          <Link href={`/app/partners/${partner.id}?fy=${encodeURIComponent(fy)}`}>View</Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {partners.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                    No partners yet.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  } catch (error) {
    if (!isMissingTableError(error)) throw error;
    return (
      <div className="mx-auto max-w-4xl space-y-4 p-4 md:p-6">
        <PageHeader eyebrow="Workforce / Partners" title="Partners" description="Database update required for partner module." />
        <div className="rounded-[24px] border border-border/70 bg-card p-4 text-sm">
          <div className="font-medium">Run Prisma migration</div>
          <pre className="mt-3 overflow-x-auto rounded-xl bg-black/40 p-3 text-xs">
{`cd "/Users/roshanvinayan/Documents/Probuild ERP/probuild-erp"
npx prisma migrate deploy`}
          </pre>
        </div>
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
