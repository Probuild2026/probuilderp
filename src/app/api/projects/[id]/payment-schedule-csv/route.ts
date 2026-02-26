import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";

import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

type DecimalLike = { toFixed: (fractionDigits: number) => string };

function money(v: DecimalLike | number | null | undefined) {
  if (typeof v === "number") return v.toFixed(2);
  if (v && typeof v.toFixed === "function") return v.toFixed(2);
  return "0.00";
}

function csvEscape(v: string) {
  if (v.includes('"') || v.includes(",") || v.includes("\n")) {
    return `"${v.replaceAll('"', '""')}"`;
  }
  return v;
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id, tenantId: session.user.tenantId },
    select: { id: true, name: true },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const stages = await prisma.projectPaymentStage.findMany({
    where: { tenantId: session.user.tenantId, projectId: project.id },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  const header = [
    "Stage",
    "Scope of Work",
    "%",
    "Expected Amount",
    "Expected Bank",
    "Expected Cash",
    "Actual Bank",
    "Actual Cash",
    "Expected Date",
    "Actual Date",
    "Notes",
  ];

  const lines: string[] = [];
  lines.push(header.map(csvEscape).join(","));
  for (const s of stages) {
    lines.push(
      [
        s.stageName,
        s.scopeOfWork ?? "",
        s.percent ? String(s.percent) : "",
        money(s.expectedAmount),
        money(s.expectedBank),
        money(s.expectedCash),
        money(s.actualBank),
        money(s.actualCash),
        s.expectedDate ? s.expectedDate.toISOString().slice(0, 10) : "",
        s.actualDate ? s.actualDate.toISOString().slice(0, 10) : "",
        s.notes ?? "",
      ].map(csvEscape).join(","),
    );
  }

  const body = lines.join("\n");
  const filename = `payment-schedule-${project.name.replaceAll(" ", "-")}.csv`;
  return new NextResponse(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
}
