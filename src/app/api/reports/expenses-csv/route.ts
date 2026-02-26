import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";

import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

function csvEscape(value: unknown) {
  const s = String(value ?? "");
  if (/[",\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const url = new URL(request.url);
  const month = url.searchParams.get("month"); // YYYY-MM
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return new NextResponse("Missing/invalid month. Use ?month=YYYY-MM", { status: 400 });
  }

  const start = new Date(`${month}-01T00:00:00`);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);

  const expenses = await prisma.expense.findMany({
    where: {
      tenantId: session.user.tenantId,
      date: { gte: start, lt: end },
    },
    include: {
      project: { select: { name: true } },
      vendor: { select: { name: true } },
      labourer: { select: { name: true } },
    },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  });

  const ids = expenses.map((e) => e.id);
  const attachmentCounts =
    ids.length === 0
      ? []
      : await prisma.attachment.groupBy({
          by: ["entityId"],
          where: { tenantId: session.user.tenantId, entityType: "EXPENSE", entityId: { in: ids } },
          _count: { _all: true },
        });
  const attachmentCountByExpense = new Map(attachmentCounts.map((a) => [a.entityId, a._count._all]));

  const header = [
    "Date",
    "Project",
    "Vendor",
    "Labourer",
    "ExpenseType",
    "AmountBeforeTax",
    "CGST",
    "SGST",
    "IGST",
    "TotalAmount",
    "PaymentMode",
    "Narration",
    "BillCount",
  ];

  const rows = expenses.map((e) => [
    e.date.toISOString().slice(0, 10),
    e.project.name,
    e.vendor?.name ?? "",
    e.labourer?.name ?? "",
    e.expenseType,
    e.amountBeforeTax.toString(),
    e.cgst.toString(),
    e.sgst.toString(),
    e.igst.toString(),
    e.totalAmount.toString(),
    e.paymentMode ?? "",
    e.narration ?? "",
    String(attachmentCountByExpense.get(e.id) ?? 0),
  ]);

  const csv =
    [header, ...rows].map((r) => r.map(csvEscape).join(",")).join("\n") + "\n";

  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename=\"expenses-${month}.csv\"`,
    },
  });
}

