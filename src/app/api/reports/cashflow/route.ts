import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

// Helper to get YYYY-MM
function toMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = session.user.tenantId;
  const { searchParams } = new URL(req.url);

  const monthsBack = parseInt(searchParams.get("months") ?? "6", 10);
  const vendorId = searchParams.get("vendorId");
  const filterType = searchParams.get("type"); // "IN", "OUT", or empty for all

  // Default to covering the last N months up to today
  const today = new Date();
  const startDate = new Date(today.getFullYear(), today.getMonth() - (monthsBack - 1), 1);

  try {
    // 1. Fetch Receipts (Money IN)
    let receipts: any[] = [];
    if (!vendorId && (!filterType || filterType === "IN")) {
      receipts = await prisma.receipt.findMany({
        where: {
          tenantId,
          date: { gte: startDate, lte: today },
        },
        select: { date: true, amountReceived: true },
      });
    }

    // 2. Fetch Expenses (Money OUT)
    let expenses: any[] = [];
    if (!filterType || filterType === "OUT") {
      expenses = await prisma.expense.findMany({
        where: {
          tenantId,
          date: { gte: startDate, lte: today },
          ...(vendorId ? { vendorId } : {}),
        },
        select: { date: true, totalAmount: true, expenseType: true },
      });
    }

    // 3. Fetch Vendor Payments (Money OUT)
    let vendorPayments: any[] = [];
    if (!filterType || filterType === "OUT") {
      vendorPayments = await prisma.vendorPayment.findMany({
        where: {
          tenantId,
          date: { gte: startDate, lte: today },
          ...(vendorId ? { vendorId } : {}),
        },
        select: { date: true, amountPaid: true, tdsAmount: true },
      });
    }

    // 4. Fetch Wages/Labour (Money OUT)
    let wages: any[] = [];
    if (!vendorId && (!filterType || filterType === "OUT")) {
      wages = await prisma.labourSheet.findMany({
        where: {
          tenantId,
          date: { gte: startDate, lte: today },
        },
        select: { date: true, total: true },
      });
    }

    // Initialize month buckets
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const chartDataMap = new Map<string, { label: string; dateSort: Date; in: number; out: number }>();

    for (let i = monthsBack - 1; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const key = toMonthKey(d);
      chartDataMap.set(key, {
        label: `${monthNames[d.getMonth()]} ${d.getFullYear()}`,
        dateSort: d,
        in: 0,
        out: 0,
      });
    }

    // Aggregate Receipts
    for (const row of receipts) {
      const key = toMonthKey(row.date);
      if (chartDataMap.has(key)) {
        chartDataMap.get(key)!.in += Number(row.amountReceived);
      }
    }

    // Aggregate Expenses
    for (const row of expenses) {
      const key = toMonthKey(row.date);
      if (chartDataMap.has(key)) {
        chartDataMap.get(key)!.out += Number(row.totalAmount);
      }
    }

    // Aggregate Vendor Payments
    for (const row of vendorPayments) {
      const key = toMonthKey(row.date);
      if (chartDataMap.has(key)) {
        chartDataMap.get(key)!.out += Number(row.amountPaid) + Number(row.tdsAmount ?? 0);
      }
    }

    // Aggregate Wages
    for (const row of wages) {
      const key = toMonthKey(row.date);
      if (chartDataMap.has(key)) {
        chartDataMap.get(key)!.out += Number(row.total);
      }
    }

    const chartData = Array.from(chartDataMap.values())
      .sort((a, b) => a.dateSort.getTime() - b.dateSort.getTime())
      .map(({ label, in: moneyIn, out: moneyOut }) => ({
        month: label,
        in: moneyIn,
        out: moneyOut,
        net: moneyIn - moneyOut,
      }));

    const summary = chartData.reduce(
      (acc, row) => {
        acc.totalIn += row.in;
        acc.totalOut += row.out;
        acc.net += row.net;
        return acc;
      },
      { totalIn: 0, totalOut: 0, net: 0 }
    );

    return NextResponse.json({ chartData, summary });
  } catch (error) {
    console.error("Cashflow aggregation error:", error);
    return NextResponse.json({ error: "Failed to load cash flow data" }, { status: 500 });
  }
}
