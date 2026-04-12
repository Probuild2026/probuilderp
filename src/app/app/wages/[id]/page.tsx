import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";

import { deleteLabourSheet } from "@/app/actions/wages";
import { ApprovalStatusControl } from "@/components/app/approval-status-control";
import { ModuleCheatSheet } from "@/components/help/module-cheat-sheet";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatINR } from "@/lib/money";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

import { WagesEditForm } from "./wages-edit-form";

function dateOnly(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function WagesDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const { id } = await params;

  const sheet = await prisma.labourSheet.findFirst({
    where: { tenantId: session.user.tenantId, id },
    include: {
      project: { select: { id: true, name: true } },
      lines: { orderBy: { createdAt: "asc" }, select: { role: true, headcount: true, rate: true } },
    },
  });
  if (!sheet) return null;

  const attachments = sheet.transactionId
    ? await prisma.attachment.findMany({
        where: { tenantId: session.user.tenantId, entityType: "TRANSACTION", entityId: sheet.transactionId },
        orderBy: { createdAt: "desc" },
      })
    : [];

  const projects = await prisma.project.findMany({
    where: { tenantId: session.user.tenantId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
    take: 500,
  });

  const total = Number(sheet.total);
  const lineCount = sheet.lines.length;
  const averageRate = lineCount ? total / Math.max(sheet.lines.reduce((sum, line) => sum + line.headcount, 0), 1) : 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Wage sheet workspace</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {sheet.project.name} • {dateOnly(sheet.date)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/app/wages">Back</Link>
          </Button>
          <form
            action={async () => {
              "use server";
              await deleteLabourSheet(sheet.id);
              redirect("/app/wages");
            }}
          >
            <Button variant="destructive" type="submit">
              Delete
            </Button>
          </form>
        </div>
      </div>

      <section className="grid gap-4 lg:grid-cols-4">
        <MetricCard label="Total" value={formatINR(total)} />
        <MetricCard label="Paid via" value={sheet.mode} />
        <MetricCard label="Worker lines" value={String(lineCount)} />
        <MetricCard label="Average rate" value={formatINR(averageRate)} />
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_360px] xl:items-start">
        <div className="space-y-6">
          <Card>
            <CardHeader className="border-b border-border/60">
              <CardTitle className="text-base">Review status</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <ApprovalStatusControl target="wage" id={sheet.id} status={sheet.approvalStatus} showHelp />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b border-border/60">
              <CardTitle className="text-base">Edit wage sheet</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <WagesEditForm
                projects={projects}
                sheet={{
                  id: sheet.id,
                  projectId: sheet.projectId,
                  date: dateOnly(sheet.date),
                  mode: sheet.mode,
                  reference: sheet.reference ?? null,
                  note: sheet.note ?? null,
                  lines: sheet.lines.map((l) => ({ role: l.role, headcount: l.headcount, rate: Number(l.rate) })),
                }}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="border-b border-border/60">
              <CardTitle className="text-base">Operational context</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-6 text-sm">
              <DetailRow label="Project" value={sheet.project.name} />
              <DetailRow label="Reference" value={sheet.reference ?? "None"} />
              <DetailRow label="Notes" value={sheet.note ?? "No notes"} />
              <DetailRow label="Transaction link" value={sheet.transactionId ?? "Not linked"} />
              <DetailRow label="Attachments" value={String(attachments.length)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b border-border/60">
              <CardTitle className="text-base">Attachments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-6">
              {attachments.length === 0 ? (
                <div className="text-sm text-muted-foreground">No attachments yet.</div>
              ) : (
                attachments.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-3 rounded-[18px] border border-border/60 bg-background/70 px-4 py-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{a.originalName}</div>
                      <div className="text-xs text-muted-foreground">{a.mimeType}</div>
                    </div>
                    <Button asChild size="sm" variant="outline">
                      <a href={`/api/attachments/${a.id}`} target="_blank" rel="noreferrer">
                        Open
                      </a>
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <ModuleCheatSheet moduleKey="wages" variant="sidebar" showDecisionHints showRoutingTrigger />
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="text-lg font-semibold tracking-tight [overflow-wrap:anywhere]">{value}</CardContent>
    </Card>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="text-muted-foreground">{label}</div>
      <div className="text-right font-medium">{value}</div>
    </div>
  );
}
