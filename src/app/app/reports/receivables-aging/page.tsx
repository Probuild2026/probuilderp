import { getServerSession } from "next-auth/next";

import { AgingReportView } from "@/components/app/aging-report-view";
import { getSingleSearchParam } from "@/lib/date-range";
import { getSelectedProjectId } from "@/lib/project-filter";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";
import { buildAgingReport } from "@/server/reports/aging";

export default async function ReceivablesAgingPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const sp = (await searchParams) ?? {};
  const asOf = getSingleSearchParam(sp, "asOf");
  const projectId = await getSelectedProjectId();
  const project = projectId
    ? await prisma.project.findFirst({
        where: { tenantId: session.user.tenantId, id: projectId },
        select: { name: true },
      })
    : null;

  const report = await buildAgingReport({
    tenantId: session.user.tenantId,
    projectId,
    kind: "receivables",
    asOf,
  });

  return <AgingReportView report={report} hrefBase="/api/reports/aging/receivables" projectName={project?.name ?? null} />;
}
