import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";

import { parseDateRangeParams, getSingleSearchParam } from "@/lib/date-range";
import { getSelectedProjectId } from "@/lib/project-filter";
import { createTabularExportResponse, type ExportFormat } from "@/lib/tabular-export";
import { safeWriteAuditLog } from "@/server/audit";
import { authOptions } from "@/server/auth";
import { buildGstRegisterReport, type GstRegisterKind } from "@/server/reports/gst";

export const runtime = "nodejs";

function isExportFormat(value: string): value is ExportFormat {
  return value === "csv" || value === "xlsx" || value === "pdf";
}

function isGstRegisterKind(value: string): value is GstRegisterKind {
  return value === "purchase" || value === "sales";
}

export async function GET(request: Request, { params }: { params: Promise<{ kind: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const { kind } = await params;
  if (!isGstRegisterKind(kind)) return new NextResponse("Unknown GST register.", { status: 404 });

  const url = new URL(request.url);
  const { from, to } = parseDateRangeParams(url.searchParams);
  const formatRaw = getSingleSearchParam(url.searchParams, "format");
  const format: ExportFormat = isExportFormat(formatRaw) ? formatRaw : "csv";

  const report = await buildGstRegisterReport({
    tenantId: session.user.tenantId,
    projectId: await getSelectedProjectId(),
    kind,
    from,
    to,
  });

  await safeWriteAuditLog({
    tenantId: session.user.tenantId,
    userId: session.user.id,
    userEmail: session.user.email,
    action: "EXPORT",
    entityType: `GST_${kind.toUpperCase()}_REGISTER`,
    summary: `${kind} GST register exported as ${format}.`,
    metadata: { kind, from: from || null, to: to || null, format },
  });

  return createTabularExportResponse(report.dataset, format);
}
