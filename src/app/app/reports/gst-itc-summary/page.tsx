import { getServerSession } from "next-auth/next";

import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { authOptions } from "@/server/auth";
import { buildMonthlyItcReport } from "@/server/reports/gst";

function formatINR(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);
}

function monthLabel(ym: string) {
  const [year, month] = ym.split("-");
  const d = new Date(Number(year), Number(month) - 1, 1);
  return d.toLocaleString("en-IN", { month: "short", year: "numeric" });
}

function currentFy() {
  const now = new Date();
  const fyStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${fyStart}-${String(fyStart + 1).slice(2)}`;
}

export default async function GstItcSummaryPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const sp = (await searchParams) ?? {};
  const fy = typeof sp.fy === "string" ? sp.fy : currentFy();

  const rows = await buildMonthlyItcReport({ tenantId: session.user.tenantId, fy });

  const totalItc = rows.reduce((s, r) => s + r.inputTaxCredit, 0);
  const totalOutput = rows.reduce((s, r) => s + r.outputTax, 0);
  const totalNet = Math.max(0, totalOutput - totalItc);
  const totalExcess = Math.max(0, totalItc - totalOutput);

  const fyOptions = [-1, 0, 1].map((offset) => {
    const now = new Date();
    const start = (now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1) + offset;
    return `${start}-${String(start + 1).slice(2)}`;
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <PageHeader
        eyebrow="Reports / GST"
        title="Monthly ITC Summary"
        description="Month-wise Input Tax Credit claimed vs. Output Tax liability. Use this for GSTR-3B reconciliation."
      />

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Financial year:</span>
        {fyOptions.map((f) => (
          <a
            key={f}
            href={`?fy=${f}`}
            className={`rounded-full border px-3 py-1 text-sm transition-colors ${f === fy ? "border-foreground bg-foreground text-background" : "border-border hover:bg-muted"}`}
          >
            FY {f}
          </a>
        ))}
      </div>

      <section className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Total ITC (FY)", value: formatINR(totalItc), tone: "success" },
          { label: "Total Output Tax (FY)", value: formatINR(totalOutput), tone: "warning" },
          { label: "Net GST Payable", value: formatINR(totalNet), tone: totalNet > 0 ? "danger" : "neutral" },
          { label: "Excess ITC (Carry-fwd)", value: formatINR(totalExcess), tone: totalExcess > 0 ? "info" : "neutral" },
        ].map((card) => (
          <div key={card.label} className="rounded-[22px] border border-border/60 bg-card px-4 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{card.label}</div>
            <div className="mt-3 text-xl font-semibold tracking-tight">{card.value}</div>
          </div>
        ))}
      </section>

      <Card>
        <CardHeader className="border-b border-border/60">
          <CardTitle className="text-base">Month-wise breakdown — FY {fy}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">ITC Claimed</TableHead>
                <TableHead className="text-right">Output Tax</TableHead>
                <TableHead className="text-right">Net Payable</TableHead>
                <TableHead className="text-right">Excess ITC</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const hasActivity = row.inputTaxCredit > 0 || row.outputTax > 0;
                return (
                  <TableRow key={row.month} className={!hasActivity ? "opacity-40" : ""}>
                    <TableCell className="font-medium">{monthLabel(row.month)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatINR(row.inputTaxCredit)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatINR(row.outputTax)}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.netPayable > 0 ? formatINR(row.netPayable) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.excessItc > 0 ? formatINR(row.excessItc) : "—"}</TableCell>
                    <TableCell>
                      {!hasActivity ? (
                        <Badge variant="outline">No activity</Badge>
                      ) : row.netPayable > 0 ? (
                        <Badge variant="destructive">Payable</Badge>
                      ) : row.excessItc > 0 ? (
                        <Badge variant="secondary">Excess ITC</Badge>
                      ) : (
                        <Badge variant="outline">Nil</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="rounded-[18px] border border-border/60 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
        ITC is counted only where the vendor has a valid GSTIN. Output tax is from client invoices in the same period. This is a management view — always cross-verify against your GSTR-2B before filing GSTR-3B.
      </div>
    </div>
  );
}
