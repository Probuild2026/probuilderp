import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";

import { getSingleSearchParam } from "@/lib/date-range";
import { getSelectedProjectId } from "@/lib/project-filter";
import { createTabularExportResponse, type ExportFormat } from "@/lib/tabular-export";
import { authOptions } from "@/server/auth";
import { buildAgingReport, type AgingKind } from "@/server/reports/aging";

export const runtime = "nodejs";

function isExportFormat(value: string): value is ExportFormat {
  return value === "csv" || value === "xlsx" || value === "pdf";
}

function isAgingKind(value: string): value is AgingKind {
  return value === "receivables" || value === "payables";
}

export async function GET(request: Request, { params }: { params: Promise<{ kind: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const { kind } = await params;
  if (!isAgingKind(kind)) return new NextResponse("Unknown aging report.", { status: 404 });

  const url = new URL(request.url);
  const asOf = getSingleSearchParam(url.searchParams, "asOf");
  const formatRaw = getSingleSearchParam(url.searchParams, "format");
  const format: ExportFormat = isExportFormat(formatRaw) ? formatRaw : "csv";

  const report = await buildAgingReport({
    tenantId: session.user.tenantId,
    projectId: await getSelectedProjectId(),
    kind,
    asOf,
  });

  return createTabularExportResponse(report.dataset, format);
}
