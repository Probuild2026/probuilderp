import { buildInclusiveDateRange } from "@/lib/date-range";
import { type TabularDataset } from "@/lib/tabular-export";
import { prisma } from "@/server/db";

export type GstRegisterKind = "purchase" | "sales";
export type GstRegisterSourceType = "BILL" | "EXPENSE" | "INVOICE";

export type GstRegisterRow = {
  id: string;
  date: string;
  sourceType: GstRegisterSourceType;
  projectName: string;
  partyName: string;
  partyGstin: string;
  documentNumber: string;
  gstType: string;
  gstRateLabel: string;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
  settledAmount?: number;
  linkedCount?: number;
  note: string;
};

export type GstRegisterSummary = {
  rowCount: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
  settledAmount?: number;
};

export type GstRegisterReport = {
  kind: GstRegisterKind;
  title: string;
  from: string;
  to: string;
  note?: string;
  rows: GstRegisterRow[];
  summary: GstRegisterSummary;
  dataset: TabularDataset;
};

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function round2(value: number) {
  return Number(value.toFixed(2));
}

function rateLabel(rate: number | null | undefined) {
  return rate == null ? "" : `${rate}%`;
}

function inferredExpenseGstType({ cgst, sgst, igst }: { cgst: number; sgst: number; igst: number }) {
  if (igst > 0) return "INTER";
  if (cgst > 0 || sgst > 0) return "INTRA";
  return "NOGST";
}

function inferredExpenseGstRate({ taxableValue, cgst, sgst, igst }: { taxableValue: number; cgst: number; sgst: number; igst: number }) {
  if (taxableValue <= 0) return null;
  const tax = cgst + sgst + igst;
  if (tax <= 0) return 0;
  return round2((tax / taxableValue) * 100);
}

function buildBaseSummary(rows: GstRegisterRow[]): GstRegisterSummary {
  return rows.reduce<GstRegisterSummary>(
    (acc, row) => {
      acc.rowCount += 1;
      acc.taxableValue = round2(acc.taxableValue + row.taxableValue);
      acc.cgst = round2(acc.cgst + row.cgst);
      acc.sgst = round2(acc.sgst + row.sgst);
      acc.igst = round2(acc.igst + row.igst);
      acc.total = round2(acc.total + row.total);
      return acc;
    },
    { rowCount: 0, taxableValue: 0, cgst: 0, sgst: 0, igst: 0, total: 0 },
  );
}

export async function buildGstRegisterReport({
  tenantId,
  projectId,
  kind,
  from,
  to,
}: {
  tenantId: number;
  projectId?: string;
  kind: GstRegisterKind;
  from?: string;
  to?: string;
}): Promise<GstRegisterReport> {
  const dateRange = buildInclusiveDateRange(from, to);
  const fromValue = from?.trim() ?? "";
  const toValue = to?.trim() ?? "";

  if (kind === "purchase") {
    const [bills, expenses] = await Promise.all([
      prisma.purchaseInvoice.findMany({
        where: {
          tenantId,
          ...(projectId ? { projectId } : {}),
          ...(dateRange ? { invoiceDate: dateRange } : {}),
        },
        orderBy: [{ invoiceDate: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          invoiceDate: true,
          invoiceNumber: true,
          gstType: true,
          gstRate: true,
          taxableValue: true,
          cgst: true,
          sgst: true,
          igst: true,
          total: true,
          tdsSection: true,
          tdsAmount: true,
          vendor: { select: { name: true, gstin: true } },
          project: { select: { name: true } },
        },
      }),
      prisma.expense.findMany({
        where: {
          tenantId,
          ...(projectId ? { projectId } : {}),
          ...(dateRange ? { date: dateRange } : {}),
        },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          date: true,
          amountBeforeTax: true,
          cgst: true,
          sgst: true,
          igst: true,
          totalAmount: true,
          paymentMode: true,
          narration: true,
          expenseType: true,
          vendor: { select: { name: true, gstin: true } },
          labourer: { select: { name: true } },
          project: { select: { name: true } },
        },
      }),
    ]);

    const rows = [
      ...bills.map((bill) => ({
        id: bill.id,
        date: dateOnly(bill.invoiceDate),
        sourceType: "BILL" as const,
        projectName: bill.project.name,
        partyName: bill.vendor.name,
        partyGstin: bill.vendor.gstin ?? "",
        documentNumber: bill.invoiceNumber,
        gstType: bill.gstType,
        gstRateLabel: rateLabel(bill.gstRate ? Number(bill.gstRate) : null),
        taxableValue: round2(Number(bill.taxableValue)),
        cgst: round2(Number(bill.cgst)),
        sgst: round2(Number(bill.sgst)),
        igst: round2(Number(bill.igst)),
        total: round2(Number(bill.total)),
        note: [bill.tdsSection, bill.tdsAmount ? `TDS ${round2(Number(bill.tdsAmount))}` : ""].filter(Boolean).join(" • "),
      } satisfies GstRegisterRow)),
      ...expenses.map((expense) => {
        const taxableValue = round2(Number(expense.amountBeforeTax));
        const cgst = round2(Number(expense.cgst));
        const sgst = round2(Number(expense.sgst));
        const igst = round2(Number(expense.igst));
        const inferredRate = inferredExpenseGstRate({ taxableValue, cgst, sgst, igst });
        return {
          id: expense.id,
          date: dateOnly(expense.date),
          sourceType: "EXPENSE" as const,
          projectName: expense.project.name,
          partyName: expense.vendor?.name ?? expense.labourer?.name ?? expense.expenseType,
          partyGstin: expense.vendor?.gstin ?? "",
          documentNumber: `Expense ${expense.id.slice(-6).toUpperCase()}`,
          gstType: inferredExpenseGstType({ cgst, sgst, igst }),
          gstRateLabel: rateLabel(inferredRate),
          taxableValue,
          cgst,
          sgst,
          igst,
          total: round2(Number(expense.totalAmount)),
          note: [expense.expenseType, expense.paymentMode ?? "", expense.narration ?? ""].filter(Boolean).join(" • "),
        } satisfies GstRegisterRow;
      }),
    ].sort((left, right) => `${right.date}|${right.sourceType}|${right.documentNumber}`.localeCompare(`${left.date}|${left.sourceType}|${left.documentNumber}`));

    const summary = buildBaseSummary(rows);

    return {
      kind,
      title: "GST Purchase Register",
      from: fromValue,
      to: toValue,
      note: "Combines purchase bills and direct expenses. Expense GST type/rate is inferred from stored tax amounts because the expense model stores components, not GST classification.",
      rows,
      summary,
      dataset: {
        title: "GST Purchase Register",
        filenameBase: `gst-purchase-register-${fromValue || "start"}-to-${toValue || "today"}`,
        metaLines: [
          `Period: ${fromValue || "Start"} to ${toValue || "Today"}`,
          "Rows include purchase bills and direct expense entries.",
        ],
        columns: [
          { key: "date", label: "Date", width: 12 },
          { key: "sourceType", label: "Source", width: 12 },
          { key: "projectName", label: "Project", width: 22 },
          { key: "partyName", label: "Vendor / Payee", width: 22 },
          { key: "partyGstin", label: "GSTIN", width: 18 },
          { key: "documentNumber", label: "Document", width: 18 },
          { key: "gstType", label: "GST Type", width: 10 },
          { key: "gstRateLabel", label: "GST Rate", width: 10 },
          { key: "taxableValue", label: "Taxable", width: 14, align: "right" },
          { key: "cgst", label: "CGST", width: 12, align: "right" },
          { key: "sgst", label: "SGST", width: 12, align: "right" },
          { key: "igst", label: "IGST", width: 12, align: "right" },
          { key: "total", label: "Total", width: 14, align: "right" },
          { key: "note", label: "Note", width: 30 },
        ],
        rows,
      },
    };
  }

  const invoices = await prisma.clientInvoice.findMany({
    where: {
      tenantId,
      ...(projectId ? { projectId } : {}),
      ...(dateRange ? { invoiceDate: dateRange } : {}),
    },
    orderBy: [{ invoiceDate: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      invoiceDate: true,
      invoiceNumber: true,
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
      client: { select: { name: true, gstin: true } },
      project: { select: { name: true } },
    },
  });

  const receipts =
    invoices.length === 0
      ? []
      : await prisma.receipt.findMany({
          where: { tenantId, clientInvoiceId: { in: invoices.map((invoice) => invoice.id) } },
          select: { clientInvoiceId: true, amountReceived: true, tdsAmount: true },
        });

  const receiptStatsByInvoiceId = new Map<string, { gross: number; count: number }>();
  for (const receipt of receipts) {
    const current = receiptStatsByInvoiceId.get(receipt.clientInvoiceId) ?? { gross: 0, count: 0 };
    current.gross = round2(current.gross + Number(receipt.amountReceived) + Number(receipt.tdsAmount ?? 0));
    current.count += 1;
    receiptStatsByInvoiceId.set(receipt.clientInvoiceId, current);
  }

  const rows = invoices.map((invoice) => {
    const receiptStats = receiptStatsByInvoiceId.get(invoice.id) ?? { gross: 0, count: 0 };
    return {
      id: invoice.id,
      date: dateOnly(invoice.invoiceDate),
      sourceType: "INVOICE" as const,
      projectName: invoice.project.name,
      partyName: invoice.client.name,
      partyGstin: invoice.client.gstin ?? "",
      documentNumber: invoice.invoiceNumber,
      gstType: invoice.gstType,
      gstRateLabel: rateLabel(invoice.gstRate ? Number(invoice.gstRate) : null),
      taxableValue: round2(Number(invoice.basicValue)),
      cgst: round2(Number(invoice.cgst)),
      sgst: round2(Number(invoice.sgst)),
      igst: round2(Number(invoice.igst)),
      total: round2(Number(invoice.total)),
      settledAmount: receiptStats.gross,
      linkedCount: receiptStats.count,
      note: [invoice.sacCode ? `SAC ${invoice.sacCode}` : "", invoice.tdsRate ? `Expected TDS ${Number(invoice.tdsRate)}%` : "", invoice.tdsAmountExpected ? `TDS ${round2(Number(invoice.tdsAmountExpected))}` : ""].filter(Boolean).join(" • "),
    } satisfies GstRegisterRow;
  });

  const summary = buildBaseSummary(rows);
  summary.settledAmount = round2(rows.reduce((acc, row) => acc + (row.settledAmount ?? 0), 0));

  return {
    kind,
    title: "GST Sales Register",
    from: fromValue,
    to: toValue,
    note: "Receipt linkage shows total recorded receipts against the listed invoices, regardless of receipt date.",
    rows,
    summary,
    dataset: {
      title: "GST Sales Register",
      filenameBase: `gst-sales-register-${fromValue || "start"}-to-${toValue || "today"}`,
      metaLines: [
        `Period: ${fromValue || "Start"} to ${toValue || "Today"}`,
        "Rows are invoice-date based; receipt columns show linkage recorded against those invoices.",
      ],
      columns: [
        { key: "date", label: "Date", width: 12 },
        { key: "projectName", label: "Project", width: 22 },
        { key: "partyName", label: "Client", width: 22 },
        { key: "partyGstin", label: "GSTIN", width: 18 },
        { key: "documentNumber", label: "Invoice #", width: 18 },
        { key: "gstType", label: "GST Type", width: 10 },
        { key: "gstRateLabel", label: "GST Rate", width: 10 },
        { key: "taxableValue", label: "Taxable", width: 14, align: "right" },
        { key: "cgst", label: "CGST", width: 12, align: "right" },
        { key: "sgst", label: "SGST", width: 12, align: "right" },
        { key: "igst", label: "IGST", width: 12, align: "right" },
        { key: "total", label: "Invoice Total", width: 14, align: "right" },
        { key: "settledAmount", label: "Receipts Linked", width: 14, align: "right" },
        { key: "linkedCount", label: "Receipt Count", width: 12, align: "right" },
        { key: "note", label: "Note", width: 30 },
      ],
      rows,
    },
  };
}
