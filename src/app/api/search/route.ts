import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

function qParam(url: URL) {
  const q = url.searchParams.get("q") ?? "";
  return q.trim().slice(0, 200);
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ items: [] }, { status: 401 });

  const url = new URL(req.url);
  const q = qParam(url);
  if (!q) return NextResponse.json({ items: [] });

  const tenantId = session.user.tenantId;

  const [projects, clients, vendors, partners, bills, invoices, payments, receipts] = await Promise.all([
    prisma.project.findMany({
      where: { tenantId, name: { contains: q, mode: "insensitive" } },
      take: 8,
      select: { id: true, name: true },
    }),
    prisma.client.findMany({
      where: { tenantId, name: { contains: q, mode: "insensitive" } },
      take: 8,
      select: { id: true, name: true, gstin: true },
    }),
    prisma.vendor.findMany({
      where: { tenantId, name: { contains: q, mode: "insensitive" } },
      take: 8,
      select: { id: true, name: true, trade: true },
    }),
    prisma.partner.findMany({
      where: { tenantId, name: { contains: q, mode: "insensitive" } },
      take: 8,
      select: { id: true, name: true, pan: true },
    }),
    prisma.purchaseInvoice.findMany({
      where: {
        tenantId,
        OR: [
          { invoiceNumber: { contains: q, mode: "insensitive" } },
          { vendor: { name: { contains: q, mode: "insensitive" } } },
        ],
      },
      take: 8,
      orderBy: { invoiceDate: "desc" },
      select: { id: true, invoiceNumber: true, total: true, vendor: { select: { name: true } }, project: { select: { name: true } } },
    }),
    prisma.clientInvoice.findMany({
      where: {
        tenantId,
        OR: [
          { invoiceNumber: { contains: q, mode: "insensitive" } },
          { client: { name: { contains: q, mode: "insensitive" } } },
        ],
      },
      take: 8,
      orderBy: { invoiceDate: "desc" },
      select: { id: true, invoiceNumber: true, total: true, client: { select: { name: true } }, project: { select: { name: true } } },
    }),
    prisma.vendorPayment.findMany({
      where: {
        tenantId,
        OR: [
          { reference: { contains: q, mode: "insensitive" } },
          { vendor: { name: { contains: q, mode: "insensitive" } } },
        ],
      },
      take: 8,
      orderBy: { date: "desc" },
      select: {
        id: true,
        date: true,
        amountPaid: true,
        reference: true,
        vendor: { select: { name: true } },
        purchaseInvoice: { select: { invoiceNumber: true } },
      },
    }),
    prisma.receipt.findMany({
      where: {
        tenantId,
        OR: [
          { reference: { contains: q, mode: "insensitive" } },
          { clientInvoice: { client: { name: { contains: q, mode: "insensitive" } } } },
          { clientInvoice: { invoiceNumber: { contains: q, mode: "insensitive" } } },
        ],
      },
      take: 8,
      orderBy: { date: "desc" },
      select: {
        id: true,
        date: true,
        amountReceived: true,
        clientInvoice: { select: { invoiceNumber: true, client: { select: { name: true } }, project: { select: { name: true } } } },
      },
    }),
  ]);

  const items = [
    ...projects.map((p) => ({
      type: "project" as const,
      id: p.id,
      title: p.name,
      subtitle: "Project",
      href: `/app/projects/${p.id}`,
    })),
    ...clients.map((c) => ({
      type: "client" as const,
      id: c.id,
      title: c.name,
      subtitle: c.gstin ? `GSTIN ${c.gstin}` : "Client",
      href: `/app/clients/${c.id}`,
    })),
    ...vendors.map((v) => ({
      type: "vendor" as const,
      id: v.id,
      title: v.name,
      subtitle: v.trade ? v.trade : "Vendor",
      href: `/app/vendors?q=${encodeURIComponent(v.name)}`,
    })),
    ...partners.map((p) => ({
      type: "partner" as const,
      id: p.id,
      title: p.name,
      subtitle: p.pan ? `PAN ${p.pan}` : "Partner",
      href: `/app/partners/${p.id}`,
    })),
    ...bills.map((b) => ({
      type: "bill" as const,
      id: b.id,
      title: `${b.vendor.name} • ${b.invoiceNumber}`,
      subtitle: b.project?.name ? b.project.name : undefined,
      href: `/app/purchases/bills/${b.id}`,
    })),
    ...invoices.map((i) => ({
      type: "invoice" as const,
      id: i.id,
      title: `${i.client.name} • ${i.invoiceNumber}`,
      subtitle: i.project?.name ? i.project.name : undefined,
      href: `/app/sales/invoices/${i.id}`,
    })),
    ...payments.map((p) => ({
      type: "payment" as const,
      id: p.id,
      title: `${p.vendor.name} • ${p.purchaseInvoice?.invoiceNumber ?? "Payment"}`,
      subtitle: p.reference ? p.reference : undefined,
      href: `/app/purchases/payments-made/${p.id}`,
    })),
    ...receipts.map((r) => ({
      type: "receipt" as const,
      id: r.id,
      title: `${r.clientInvoice.client.name} • ${r.clientInvoice.invoiceNumber}`,
      subtitle: r.clientInvoice.project?.name ? r.clientInvoice.project.name : undefined,
      href: `/app/sales/receipts/${r.id}`,
    })),
  ];

  return NextResponse.json({ items });
}
