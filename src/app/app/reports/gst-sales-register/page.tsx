import { getServerSession } from "next-auth/next";

import { GstRegisterView } from "@/components/app/gst-register-view";
import { parseDateRangeParams } from "@/lib/date-range";
import { getSelectedProjectId } from "@/lib/project-filter";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";
import { buildGstRegisterReport } from "@/server/reports/gst";

export default async function GstSalesRegisterPage({
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

  const report = await buildGstRegisterReport({
    tenantId: session.user.tenantId,
    projectId,
    kind: "sales",
    from,
    to,
  });

  return (
    <GstRegisterView
      report={report}
      hrefBase="/api/reports/gst/sales"
      resetHref="/app/reports/gst-sales-register"
      projectName={project?.name ?? null}
    />
  );
}
