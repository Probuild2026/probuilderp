import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";

import { parseApprovalStatus } from "@/lib/approval-status";
import { getSingleSearchParam } from "@/lib/date-range";
import { createTabularExportResponse, type ExportFormat } from "@/lib/tabular-export";
import { getSelectedProjectId } from "@/lib/project-filter";
import { safeWriteAuditLog } from "@/server/audit";
import { buildMonthlyOutflowDataset, isMonthlyOutflowEntryType } from "@/server/exports/module-datasets";
import { authOptions } from "@/server/auth";

export const runtime = "nodejs";

function isExportFormat(value: string): value is ExportFormat {
  return value === "csv" || value === "xlsx" || value === "pdf";
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const url = new URL(request.url);
  const month = getSingleSearchParam(url.searchParams, "month"); // YYYY-MM
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return new NextResponse("Missing/invalid month. Use ?month=YYYY-MM", { status: 400 });
  }
  const formatRaw = getSingleSearchParam(url.searchParams, "format");
  const format: ExportFormat = isExportFormat(formatRaw) ? formatRaw : "csv";
  const q = getSingleSearchParam(url.searchParams, "q");
  const approval = parseApprovalStatus(getSingleSearchParam(url.searchParams, "approval"));
  const entryTypeRaw = getSingleSearchParam(url.searchParams, "entryType");
  const entryType = isMonthlyOutflowEntryType(entryTypeRaw) ? entryTypeRaw : undefined;

  const dataset = await buildMonthlyOutflowDataset({
    tenantId: session.user.tenantId,
    projectId: await getSelectedProjectId(),
    month,
    q,
    approval,
    entryType,
  });

  await safeWriteAuditLog({
    tenantId: session.user.tenantId,
    userId: session.user.id,
    userEmail: session.user.email,
    action: "EXPORT",
    entityType: "MONTHLY_OUTFLOW",
    summary: `Monthly outflow report exported as ${format}.`,
    metadata: { month, format },
  });

  return createTabularExportResponse(dataset, format);
}
