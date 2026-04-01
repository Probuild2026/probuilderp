import { prisma } from "@/server/db";
import { type TabularDataset } from "@/lib/tabular-export";

export type AgingKind = "receivables" | "payables";

export type AgingBucket = "CURRENT" | "1_30" | "31_60" | "61_90" | "90_PLUS";

export type AgingRow = {
  id: string;
  documentNumber: string;
  documentDate: string;
  basisDate: string;
  projectName: string;
  partyName: string;
  totalAmount: number;
  settledAmount: number;
  outstandingAmount: number;
  ageDays: number;
  bucket: AgingBucket;
};

export type AgingReport = {
  kind: AgingKind;
  title: string;
  asOf: string;
  note?: string;
  summary: Array<{ bucket: AgingBucket; label: string; amount: number }>;
  rows: AgingRow[];
  dataset: TabularDataset;
};

const bucketOrder: AgingBucket[] = ["CURRENT", "1_30", "31_60", "61_90", "90_PLUS"];

const bucketLabels: Record<AgingBucket, string> = {
  CURRENT: "Current",
  "1_30": "1-30 days",
  "31_60": "31-60 days",
  "61_90": "61-90 days",
  "90_PLUS": "90+ days",
};

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function startOfUtcDay(value: Date) {
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

function diffInDays(asOf: Date, basis: Date) {
  const ms = startOfUtcDay(asOf) - startOfUtcDay(basis);
  return Math.floor(ms / 86_400_000);
}

function bucketForDays(days: number): AgingBucket {
  if (days <= 0) return "CURRENT";
  if (days <= 30) return "1_30";
  if (days <= 60) return "31_60";
  if (days <= 90) return "61_90";
  return "90_PLUS";
}

function parseAsOf(asOf?: string) {
  const value = (asOf ?? "").trim();
  if (!value) return new Date();
  return new Date(`${value}T00:00:00.000Z`);
}

function baseSummary() {
  return new Map<AgingBucket, number>(bucketOrder.map((bucket) => [bucket, 0]));
}

export async function buildAgingReport({
  tenantId,
  projectId,
  kind,
  asOf,
}: {
  tenantId: number;
  projectId?: string;
  kind: AgingKind;
  asOf?: string;
}): Promise<AgingReport> {
  const asOfDate = parseAsOf(asOf);
  const asOfValue = dateOnly(asOfDate);

  if (kind === "receivables") {
    const invoices = await prisma.clientInvoice.findMany({
      where: {
        tenantId,
        ...(projectId ? { projectId } : {}),
      },
      orderBy: [{ dueDate: "asc" }, { invoiceDate: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        invoiceNumber: true,
        invoiceDate: true,
        dueDate: true,
        total: true,
        project: { select: { name: true } },
        client: { select: { name: true } },
      },
    });

    const settlements =
      invoices.length === 0
        ? []
        : await prisma.transactionAllocation.groupBy({
            by: ["documentId"],
            where: {
              tenantId,
              documentType: "CLIENT_INVOICE",
              documentId: { in: invoices.map((invoice) => invoice.id) },
            },
            _sum: { grossAmount: true },
          });

    const settledByInvoiceId = new Map(settlements.map((row) => [row.documentId, Number(row._sum.grossAmount ?? 0)]));
    const summary = baseSummary();

    const rows = invoices
      .map((invoice) => {
        const totalAmount = Number(invoice.total);
        const settledAmount = settledByInvoiceId.get(invoice.id) ?? 0;
        const outstandingAmount = Math.max(0, Number((totalAmount - settledAmount).toFixed(2)));
        if (outstandingAmount <= 0) return null;

        const basis = invoice.dueDate ?? invoice.invoiceDate;
        const ageDays = Math.max(0, diffInDays(asOfDate, basis));
        const bucket = bucketForDays(diffInDays(asOfDate, basis));
        summary.set(bucket, (summary.get(bucket) ?? 0) + outstandingAmount);

        return {
          id: invoice.id,
          documentNumber: invoice.invoiceNumber,
          documentDate: dateOnly(invoice.invoiceDate),
          basisDate: dateOnly(basis),
          projectName: invoice.project.name,
          partyName: invoice.client.name,
          totalAmount,
          settledAmount,
          outstandingAmount,
          ageDays,
          bucket,
        } satisfies AgingRow;
      })
      .filter((row): row is AgingRow => row !== null);

    return {
      kind,
      title: "Receivables Aging",
      asOf: asOfValue,
      note: "Aging is based on due date when available, otherwise invoice date.",
      summary: bucketOrder.map((bucket) => ({
        bucket,
        label: bucketLabels[bucket],
        amount: Number((summary.get(bucket) ?? 0).toFixed(2)),
      })),
      rows,
      dataset: {
        title: `Receivables Aging - ${asOfValue}`,
        filenameBase: `receivables-aging-${asOfValue}`,
        metaLines: [`As of: ${asOfValue}`, "Aging basis: due date, falling back to invoice date."],
        columns: [
          { key: "documentDate", label: "Invoice Date", width: 12 },
          { key: "basisDate", label: "Due Date", width: 12 },
          { key: "projectName", label: "Project", width: 22 },
          { key: "partyName", label: "Client", width: 22 },
          { key: "documentNumber", label: "Invoice #", width: 16 },
          { key: "totalAmount", label: "Total", width: 14, align: "right" },
          { key: "settledAmount", label: "Settled", width: 14, align: "right" },
          { key: "outstandingAmount", label: "Outstanding", width: 14, align: "right" },
          { key: "ageDays", label: "Age Days", width: 10, align: "right" },
          { key: "bucketLabel", label: "Bucket", width: 14 },
        ],
        rows: rows.map((row) => ({
          ...row,
          bucketLabel: bucketLabels[row.bucket],
        })),
      },
    };
  }

  const bills = await prisma.purchaseInvoice.findMany({
    where: {
      tenantId,
      ...(projectId ? { projectId } : {}),
    },
    orderBy: [{ invoiceDate: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      invoiceNumber: true,
      invoiceDate: true,
      total: true,
      project: { select: { name: true } },
      vendor: { select: { name: true } },
    },
  });

  const payments =
    bills.length === 0
      ? []
      : await prisma.transactionAllocation.groupBy({
          by: ["documentId"],
          where: {
            tenantId,
            documentType: "PURCHASE_INVOICE",
            documentId: { in: bills.map((bill) => bill.id) },
          },
          _sum: { grossAmount: true },
        });

  const paidByBillId = new Map(payments.map((row) => [row.documentId, Number(row._sum.grossAmount ?? 0)]));
  const summary = baseSummary();

  const rows = bills
    .map((bill) => {
      const totalAmount = Number(bill.total);
      const settledAmount = paidByBillId.get(bill.id) ?? 0;
      const outstandingAmount = Math.max(0, Number((totalAmount - settledAmount).toFixed(2)));
      if (outstandingAmount <= 0) return null;

      const ageDays = Math.max(0, diffInDays(asOfDate, bill.invoiceDate));
      const bucket = bucketForDays(diffInDays(asOfDate, bill.invoiceDate));
      summary.set(bucket, (summary.get(bucket) ?? 0) + outstandingAmount);

      return {
        id: bill.id,
        documentNumber: bill.invoiceNumber,
        documentDate: dateOnly(bill.invoiceDate),
        basisDate: dateOnly(bill.invoiceDate),
        projectName: bill.project.name,
        partyName: bill.vendor.name,
        totalAmount,
        settledAmount,
        outstandingAmount,
        ageDays,
        bucket,
      } satisfies AgingRow;
    })
    .filter((row): row is AgingRow => row !== null);

  return {
    kind,
    title: "Payables Aging",
    asOf: asOfValue,
    note: "Aging is currently based on bill date because vendor due date is not stored yet.",
    summary: bucketOrder.map((bucket) => ({
      bucket,
      label: bucketLabels[bucket],
      amount: Number((summary.get(bucket) ?? 0).toFixed(2)),
    })),
    rows,
    dataset: {
      title: `Payables Aging - ${asOfValue}`,
      filenameBase: `payables-aging-${asOfValue}`,
      metaLines: [`As of: ${asOfValue}`, "Aging basis: bill date until vendor due date is added."],
      columns: [
        { key: "documentDate", label: "Bill Date", width: 12 },
        { key: "basisDate", label: "Aging From", width: 12 },
        { key: "projectName", label: "Project", width: 22 },
        { key: "partyName", label: "Vendor", width: 22 },
        { key: "documentNumber", label: "Bill #", width: 16 },
        { key: "totalAmount", label: "Total", width: 14, align: "right" },
        { key: "settledAmount", label: "Settled", width: 14, align: "right" },
        { key: "outstandingAmount", label: "Outstanding", width: 14, align: "right" },
        { key: "ageDays", label: "Age Days", width: 10, align: "right" },
        { key: "bucketLabel", label: "Bucket", width: 14 },
      ],
      rows: rows.map((row) => ({
        ...row,
        bucketLabel: bucketLabels[row.bucket],
      })),
    },
  };
}
