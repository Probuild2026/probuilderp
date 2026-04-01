import { getServerSession } from "next-auth/next";

import { TdsDashboardView } from "@/components/app/tds-dashboard-view";
import { authOptions } from "@/server/auth";
import { buildTdsDashboardReport } from "@/server/reports/tds";

export default async function TdsDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const sp = (await searchParams) ?? {};
  const fy = typeof sp.fy === "string" ? sp.fy : "";
  const report = await buildTdsDashboardReport({ tenantId: session.user.tenantId, fy });

  return <TdsDashboardView report={report} hrefBase="/api/reports/tds-dashboard" resetHref="/app/reports/tds-dashboard" />;
}
