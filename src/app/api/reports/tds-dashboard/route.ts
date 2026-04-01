import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";

import { getSingleSearchParam } from "@/lib/date-range";
import { createTabularExportResponse, type ExportFormat } from "@/lib/tabular-export";
import { safeWriteAuditLog } from "@/server/audit";
import { authOptions } from "@/server/auth";
import { buildTdsDashboardReport } from "@/server/reports/tds";

export const runtime = "nodejs";

function isExportFormat(value: string): value is ExportFormat {
  return value === "csv" || value === "xlsx" || value === "pdf";
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const url = new URL(request.url);
  const fy = getSingleSearchParam(url.searchParams, "fy");
  const formatRaw = getSingleSearchParam(url.searchParams, "format");
  const format: ExportFormat = isExportFormat(formatRaw) ? formatRaw : "csv";

  const report = await buildTdsDashboardReport({
    tenantId: session.user.tenantId,
    fy,
  });

  await safeWriteAuditLog({
    tenantId: session.user.tenantId,
    userId: session.user.id,
    userEmail: session.user.email,
    action: "EXPORT",
    entityType: "TDS_DASHBOARD",
    summary: `TDS dashboard exported as ${format}.`,
    metadata: { fy: fy || null, format },
  });

  return createTabularExportResponse(report.dataset, format);
}
