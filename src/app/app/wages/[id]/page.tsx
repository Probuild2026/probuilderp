import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";

import { deleteLabourSheet } from "@/app/actions/wages";
import { ApprovalStatusControl } from "@/components/app/approval-status-control";
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

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Labour sheet</h1>
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total</CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-semibold tabular-nums">{formatINR(total)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Paid via</CardTitle>
          </CardHeader>
          <CardContent className="text-sm font-medium">{sheet.mode}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Lines</CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-semibold tabular-nums">{lineCount}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Review Status</CardTitle>
        </CardHeader>
        <CardContent>
          <ApprovalStatusControl target="wage" id={sheet.id} status={sheet.approvalStatus} showHelp />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Edit</CardTitle>
          </CardHeader>
          <CardContent>
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

        <Card>
          <CardHeader>
            <CardTitle>Attachments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {attachments.length === 0 ? (
              <div className="text-sm text-muted-foreground">No attachments yet.</div>
            ) : (
              <div className="space-y-2">
                {attachments.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
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
                ))}
              </div>
            )}
            <div className="text-xs text-muted-foreground">Uploaded bills are stored in Vercel Blob when configured.</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
