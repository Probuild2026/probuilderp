import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";

import { parseDateRangeParams, getSingleSearchParam } from "@/lib/date-range";
import { getSelectedProjectId } from "@/lib/project-filter";
import { createTabularExportResponse, type ExportFormat } from "@/lib/tabular-export";
import { authOptions } from "@/server/auth";
import { buildLedgerReport, type LedgerKind } from "@/server/reports/ledger";

export const runtime = "nodejs";

function isExportFormat(value: string): value is ExportFormat {
  return value === "csv" || value === "xlsx" || value === "pdf";
}

function isLedgerKind(value: string): value is LedgerKind {
  return value === "client" || value === "vendor";
}

export async function GET(request: Request, { params }: { params: Promise<{ kind: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const { kind } = await params;
  if (!isLedgerKind(kind)) return new NextResponse("Unknown ledger report.", { status: 404 });

  const url = new URL(request.url);
  const { from, to } = parseDateRangeParams(url.searchParams);
  const formatRaw = getSingleSearchParam(url.searchParams, "format");
  const format: ExportFormat = isExportFormat(formatRaw) ? formatRaw : "csv";

  const report = await buildLedgerReport({
    tenantId: session.user.tenantId,
    projectId: await getSelectedProjectId(),
    kind,
    from,
    to,
  });

  return createTabularExportResponse(report.dataset, format);
}
