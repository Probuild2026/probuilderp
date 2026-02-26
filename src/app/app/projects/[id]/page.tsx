import Link from "next/link";
import { getServerSession } from "next-auth/next";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

import { PaymentSchedule } from "./payment-schedule";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id, tenantId: session.user.tenantId },
    include: {
      client: { select: { name: true } },
    },
  });

  if (!project) return null;

  const paymentStages = await prisma.projectPaymentStage.findMany({
    where: { tenantId: session.user.tenantId, projectId: project.id },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      stageName: true,
      scopeOfWork: true,
      percent: true,
      expectedAmount: true,
      expectedBank: true,
      expectedCash: true,
      actualBank: true,
      actualCash: true,
      expectedDate: true,
      actualDate: true,
      notes: true,
      sortOrder: true,
    },
  });

  const stages = paymentStages.map((s) => ({
    id: s.id,
    stageName: s.stageName,
    scopeOfWork: s.scopeOfWork,
    percent: s.percent ? Number(s.percent) : null,
    expectedAmount: Number(s.expectedAmount),
    expectedBank: Number(s.expectedBank),
    expectedCash: Number(s.expectedCash),
    actualBank: Number(s.actualBank),
    actualCash: Number(s.actualCash),
    expectedDate: s.expectedDate ? s.expectedDate.toISOString().slice(0, 10) : "",
    actualDate: s.actualDate ? s.actualDate.toISOString().slice(0, 10) : "",
    notes: s.notes ?? "",
    sortOrder: s.sortOrder,
  }));

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{project.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{project.client.name}</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/app/projects">Back</Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Status</CardTitle>
          </CardHeader>
          <CardContent className="text-sm font-medium">{project.status}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Location</CardTitle>
          </CardHeader>
          <CardContent className="text-sm font-medium">{project.location ?? "—"}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Schedule Rows</CardTitle>
          </CardHeader>
          <CardContent className="text-sm font-medium">{stages.length}</CardContent>
        </Card>
      </div>

      <PaymentSchedule projectId={project.id} stages={stages} />
    </div>
  );
}
