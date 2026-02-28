import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";

import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const vendorId = searchParams.get("vendorId");
  if (!vendorId) return NextResponse.json({ error: "vendorId required" }, { status: 400 });

  const bills = await prisma.purchaseInvoice.findMany({
    where: { tenantId: session.user.tenantId, vendorId },
    orderBy: [{ invoiceDate: "desc" }, { createdAt: "desc" }],
    take: 200,
    select: {
      id: true,
      invoiceNumber: true,
      invoiceDate: true,
      project: { select: { id: true, name: true } },
      taxableValue: true,
      total: true,
    },
  });

  if (bills.length === 0) return NextResponse.json({ items: [] });

  const paid = await prisma.transactionAllocation.groupBy({
    by: ["documentId"],
    where: {
      tenantId: session.user.tenantId,
      documentType: "PURCHASE_INVOICE",
      documentId: { in: bills.map((b) => b.id) },
    },
    _sum: { grossAmount: true },
  });

  const paidById = new Map(paid.map((p) => [p.documentId, p._sum.grossAmount ?? 0]));

  const items = bills
    .map((b) => {
      const paidGross = Number(paidById.get(b.id) ?? 0);
      const total = Number(b.total);
      const balance = Math.max(0, total - paidGross);
      return {
        id: b.id,
        invoiceNumber: b.invoiceNumber,
        invoiceDate: b.invoiceDate.toISOString().slice(0, 10),
        projectId: b.project.id,
        projectName: b.project.name,
        taxableValue: Number(b.taxableValue),
        total,
        paid: paidGross,
        balance,
      };
    })
    .filter((b) => b.balance > 0.005);

  return NextResponse.json({ items });
}

