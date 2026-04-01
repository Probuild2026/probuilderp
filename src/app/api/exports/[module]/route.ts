import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";

import { getSingleSearchParam, parseDateRangeParams } from "@/lib/date-range";
import { createTabularExportResponse, type ExportFormat } from "@/lib/tabular-export";
import { getSelectedProjectId } from "@/lib/project-filter";
import { buildModuleDataset, type ExportModule } from "@/server/exports/module-datasets";
import { authOptions } from "@/server/auth";

export const runtime = "nodejs";

const allowedModules = new Set<ExportModule>([
  "transactions",
  "expenses",
  "wages",
  "receipts",
  "invoices",
  "payments-made",
  "bills",
]);

function isExportFormat(value: string): value is ExportFormat {
  return value === "csv" || value === "xlsx" || value === "pdf";
}

export async function GET(request: Request, { params }: { params: Promise<{ module: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const { module } = await params;
  if (!allowedModules.has(module as ExportModule)) {
    return new NextResponse("Unknown export module.", { status: 404 });
  }

  const url = new URL(request.url);
  const { from, to } = parseDateRangeParams(url.searchParams);
  const q = getSingleSearchParam(url.searchParams, "q");
  const formatRaw = getSingleSearchParam(url.searchParams, "format");
  const format: ExportFormat = isExportFormat(formatRaw) ? formatRaw : "csv";

  const dataset = await buildModuleDataset(module as ExportModule, {
    tenantId: session.user.tenantId,
    projectId: await getSelectedProjectId(),
    from,
    to,
    q,
  });

  return createTabularExportResponse(dataset, format);
}
