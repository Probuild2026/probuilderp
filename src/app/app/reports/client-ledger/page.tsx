import { getServerSession } from "next-auth/next";

import { LedgerReportView } from "@/components/app/ledger-report-view";
import { parseDateRangeParams } from "@/lib/date-range";
import { getSelectedProjectId } from "@/lib/project-filter";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";
import { buildLedgerReport } from "@/server/reports/ledger";

export default async function ClientLedgerPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const sp = (await searchParams) ?? {};
  const { from, to } = parseDateRangeParams(sp);
  const projectId = await getSelectedProjectId();
  const project = projectId
    ? await prisma.project.findFirst({
        where: { tenantId: session.user.tenantId, id: projectId },
        select: { name: true },
      })
    : null;

  const report = await buildLedgerReport({
    tenantId: session.user.tenantId,
    projectId,
    kind: "client",
    from,
    to,
  });

  return (
    <LedgerReportView
      report={report}
      hrefBase="/api/reports/ledger/client"
      resetHref="/app/reports/client-ledger"
      projectName={project?.name ?? null}
    />
  );
}
