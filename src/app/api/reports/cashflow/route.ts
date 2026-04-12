import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

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
  const filterType = searchParams.get("type"); 

  const today = new Date();
  const startDate = new Date(today.getFullYear(), today.getMonth() - (monthsBack - 1), 1);

  try {
    const txns = await prisma.transaction.findMany({
      where: {
        tenantId,
        date: { gte: startDate, lte: today },
        ...(vendorId ? { vendorId } : {}),
        approvalStatus: { not: "CANCELLED" },
        ...(filterType === "IN" ? { type: "INCOME" } : filterType === "OUT" ? { type: "EXPENSE" } : { type: { in: ["INCOME", "EXPENSE"] } }),
      },
      select: {
        date: true,
        type: true,
        amount: true,
        tdsAmount: true,
      },
    });

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

    for (const row of txns) {
      const key = toMonthKey(row.date);
      if (chartDataMap.has(key)) {
        const flow = Number(row.amount) + Number(row.tdsAmount ?? 0);
        if (row.type === "INCOME") {
          chartDataMap.get(key)!.in += flow;
        } else if (row.type === "EXPENSE") {
          chartDataMap.get(key)!.out += flow;
        }
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
