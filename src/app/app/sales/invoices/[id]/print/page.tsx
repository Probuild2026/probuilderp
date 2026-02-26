import { notFound } from "next/navigation";
import { getServerSession } from "next-auth/next";

import { formatINR } from "@/lib/money";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

export default async function InvoicePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const { id } = await params;

  const [invoice, profile, receiptsSum] = await Promise.all([
    prisma.clientInvoice.findFirst({
      where: { id, tenantId: session.user.tenantId },
      select: {
        invoiceNumber: true,
        invoiceDate: true,
        dueDate: true,
        serviceDescription: true,
        sacCode: true,
        gstType: true,
        gstRate: true,
        basicValue: true,
        cgst: true,
        sgst: true,
        igst: true,
        total: true,
        tdsRate: true,
        tdsAmountExpected: true,
        status: true,
        project: { select: { name: true, location: true } },
        client: {
          select: { name: true, billingAddress: true, gstin: true, pan: true, phone: true, email: true },
        },
      },
    }),
    prisma.tenantProfile.findUnique({
      where: { tenantId: session.user.tenantId },
      select: {
        legalName: true,
        tradeName: true,
        phone: true,
        email: true,
        address: true,
        gstin: true,
        pan: true,
        bankName: true,
        bankAccountNo: true,
        bankIfsc: true,
        upiId: true,
        logoUrl: true,
      },
    }),
    prisma.receipt.aggregate({
      where: { tenantId: session.user.tenantId, clientInvoiceId: id },
      _sum: { amountReceived: true, tdsAmount: true },
    }),
  ]);

  if (!invoice) return notFound();

  const received = Number(receiptsSum._sum.amountReceived ?? 0);
  const tds = Number(receiptsSum._sum.tdsAmount ?? 0);

  const gstTotal = Number(invoice.cgst) + Number(invoice.sgst) + Number(invoice.igst);

  return (
    <div className="mx-auto max-w-3xl bg-white p-6 text-black print:p-0">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
        }
      `}</style>

      <div className="no-print mb-4 flex justify-end">
        <button
          className="rounded-md border px-3 py-2 text-sm"
          onClick={() => window.print()}
          type="button"
        >
          Print / Save PDF
        </button>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          {profile?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.logoUrl} alt="Logo" className="h-14 w-14 object-contain" />
          ) : null}
          <div>
            <div className="text-xl font-semibold">{profile?.tradeName || profile?.legalName || "Company"}</div>
            <div className="text-sm">{profile?.address}</div>
            <div className="text-sm">
              {profile?.phone ? `Phone: ${profile.phone}` : ""}
              {profile?.email ? ` · Email: ${profile.email}` : ""}
            </div>
            <div className="text-sm">
              {profile?.gstin ? `GSTIN: ${profile.gstin}` : ""}
              {profile?.pan ? ` · PAN: ${profile.pan}` : ""}
            </div>
          </div>
        </div>

        <div className="text-right">
          <div className="text-2xl font-bold">TAX INVOICE</div>
          <div className="text-sm">Invoice #: {invoice.invoiceNumber}</div>
          <div className="text-sm">Date: {invoice.invoiceDate.toISOString().slice(0, 10)}</div>
          <div className="text-sm">Due: {invoice.dueDate ? invoice.dueDate.toISOString().slice(0, 10) : "—"}</div>
          <div className="text-sm">Status: {invoice.status}</div>
        </div>
      </div>

      <hr className="my-4 border-neutral-300" />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <div className="text-sm font-semibold">Bill To</div>
          <div className="mt-1 text-sm">{invoice.client.name}</div>
          <div className="text-sm whitespace-pre-line">{invoice.client.billingAddress}</div>
          <div className="text-sm">{invoice.client.phone ? `Phone: ${invoice.client.phone}` : ""}</div>
          <div className="text-sm">{invoice.client.email ? `Email: ${invoice.client.email}` : ""}</div>
          <div className="text-sm">
            {invoice.client.gstin ? `GSTIN: ${invoice.client.gstin}` : ""}
            {invoice.client.pan ? ` · PAN: ${invoice.client.pan}` : ""}
          </div>
        </div>

        <div className="text-sm">
          <div className="font-semibold">Project</div>
          <div className="mt-1">{invoice.project.name}</div>
          <div className="text-neutral-700">{invoice.project.location}</div>
          <div className="mt-2">
            GST Type: {invoice.gstType} {invoice.gstRate != null ? ` · GST %: ${Number(invoice.gstRate)}` : ""}
          </div>
          <div>{invoice.sacCode ? `SAC: ${invoice.sacCode}` : ""}</div>
        </div>
      </div>

      <div className="mt-4 rounded-md border border-neutral-300">
        <div className="grid grid-cols-12 gap-2 border-b border-neutral-300 bg-neutral-50 p-2 text-xs font-semibold">
          <div className="col-span-7">Description</div>
          <div className="col-span-2 text-right">Basic</div>
          <div className="col-span-1 text-right">GST</div>
          <div className="col-span-2 text-right">Total</div>
        </div>
        <div className="grid grid-cols-12 gap-2 p-2 text-sm">
          <div className="col-span-7 whitespace-pre-line">
            {invoice.serviceDescription || "Construction services / project stage billing"}
          </div>
          <div className="col-span-2 text-right">{formatINR(Number(invoice.basicValue))}</div>
          <div className="col-span-1 text-right">{formatINR(gstTotal)}</div>
          <div className="col-span-2 text-right font-semibold">{formatINR(Number(invoice.total))}</div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="text-sm">
          <div className="font-semibold">Bank / UPI (optional)</div>
          <div className="mt-1">
            {profile?.bankName ? `${profile.bankName}` : ""}
            {profile?.bankAccountNo ? ` · A/c: ${profile.bankAccountNo}` : ""}
          </div>
          <div>
            {profile?.bankIfsc ? `IFSC: ${profile.bankIfsc}` : ""}
            {profile?.upiId ? ` · UPI: ${profile.upiId}` : ""}
          </div>
          <div className="mt-2 text-xs text-neutral-600">
            Please mention invoice number in narration/UTR.
          </div>
        </div>

        <div className="text-sm">
          <div className="font-semibold">Summary</div>
          <div className="mt-2 flex items-center justify-between">
            <span>Basic</span>
            <span>{formatINR(Number(invoice.basicValue))}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>GST</span>
            <span>{formatINR(gstTotal)}</span>
          </div>
          <div className="flex items-center justify-between font-semibold">
            <span>Total</span>
            <span>{formatINR(Number(invoice.total))}</span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span>Received</span>
            <span>{formatINR(received)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>TDS</span>
            <span>{formatINR(tds)}</span>
          </div>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-2">
        <div className="text-xs text-neutral-600">
          <div className="font-semibold text-black">Notes</div>
          <div className="mt-1">
            This is a system-generated invoice for tracking. Filing is not included; GST/TDS are tracked for audit.
          </div>
        </div>
        <div className="text-right text-sm">
          <div className="font-semibold">For {profile?.tradeName || profile?.legalName || "Company"}</div>
          <div className="mt-16 text-xs text-neutral-600">Authorised Signatory</div>
        </div>
      </div>
    </div>
  );
}

