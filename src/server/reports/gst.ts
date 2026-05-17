import { buildInclusiveDateRange } from "@/lib/date-range";
import { isLikelyValidGstin } from "@/lib/gst-compliance";
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
  inputTaxCredit?: number;
  outputTax?: number;
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
  inputTaxCredit: number;
  outputTax: number;
  settledAmount?: number;
};

export type GstLiabilitySummary = {
  inputTaxCredit: number;
  outputTax: number;
  netPayable: number;
  excessItc: number;
};

export type GstRegisterReport = {
  kind: GstRegisterKind;
  title: string;
  from: string;
  to: string;
  note?: string;
  rows: GstRegisterRow[];
  summary: GstRegisterSummary;
  liabilitySummary: GstLiabilitySummary;
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
      acc.inputTaxCredit = round2(acc.inputTaxCredit + (row.inputTaxCredit ?? 0));
      acc.outputTax = round2(acc.outputTax + (row.outputTax ?? 0));
      return acc;
    },
    { rowCount: 0, taxableValue: 0, cgst: 0, sgst: 0, igst: 0, total: 0, inputTaxCredit: 0, outputTax: 0 },
  );
}

function sumTaxAmounts(row: { cgst: unknown; sgst: unknown; igst: unknown }) {
  return round2(Number(row.cgst ?? 0) + Number(row.sgst ?? 0) + Number(row.igst ?? 0));
}

async function buildGstLiabilitySummary({
  tenantId,
  projectId,
  from,
  to,
}: {
  tenantId: number;
  projectId?: string;
  from?: string;
  to?: string;
}): Promise<GstLiabilitySummary> {
  const dateRange = buildInclusiveDateRange(from, to);

  const [purchaseBills, purchaseExpenses, salesInvoices] = await Promise.all([
    prisma.purchaseInvoice.findMany({
      where: {
        tenantId,
        ...(projectId ? { projectId } : {}),
        ...(dateRange ? { invoiceDate: dateRange } : {}),
      },
      select: { cgst: true, sgst: true, igst: true, vendor: { select: { gstin: true } } },
    }),
    prisma.expense.findMany({
      where: {
        tenantId,
        ...(projectId ? { projectId } : {}),
        ...(dateRange ? { date: dateRange } : {}),
      },
      select: { cgst: true, sgst: true, igst: true, vendor: { select: { gstin: true } } },
    }),
    prisma.clientInvoice.findMany({
      where: {
        tenantId,
        ...(projectId ? { projectId } : {}),
        ...(dateRange ? { invoiceDate: dateRange } : {}),
      },
      select: { cgst: true, sgst: true, igst: true },
    }),
  ]);

  const inputTaxCredit = round2(
    [...purchaseBills, ...purchaseExpenses].reduce((acc, row) => {
      return acc + (isLikelyValidGstin(row.vendor?.gstin) ? sumTaxAmounts(row) : 0);
    }, 0),
  );
  const outputTax = round2(salesInvoices.reduce((acc, row) => acc + sumTaxAmounts(row), 0));
  const netPayable = round2(Math.max(0, outputTax - inputTaxCredit));
  const excessItc = round2(Math.max(0, inputTaxCredit - outputTax));

  return { inputTaxCredit, outputTax, netPayable, excessItc };
}

export type MonthlyItcRow = {
  month: string; // "YYYY-MM"
  inputTaxCredit: number;
  outputTax: number;
  netPayable: number;
  excessItc: number;
};

export async function buildMonthlyItcReport({
  tenantId,
  projectId,
  fy,
}: {
  tenantId: number;
  projectId?: string;
  fy?: string; // "2025-26"
}): Promise<MonthlyItcRow[]> {
  const currentYear = new Date().getFullYear();
  const fyYear = fy ? parseInt(fy.split("-")[0]) : currentYear - (new Date().getMonth() < 3 ? 1 : 0);
  const fromDate = new Date(fyYear, 3, 1); // April 1
  const toDate = new Date(fyYear + 1, 2, 31); // March 31

  const [purchaseBills, purchaseExpenses, salesInvoices] = await Promise.all([
    prisma.purchaseInvoice.findMany({
      where: {
        tenantId,
        ...(projectId ? { projectId } : {}),
        invoiceDate: { gte: fromDate, lte: toDate },
      },
      select: { invoiceDate: true, cgst: true, sgst: true, igst: true, vendor: { select: { gstin: true } } },
    }),
    prisma.expense.findMany({
      where: {
        tenantId,
        ...(projectId ? { projectId } : {}),
        date: { gte: fromDate, lte: toDate },
      },
      select: { date: true, cgst: true, sgst: true, igst: true, vendor: { select: { gstin: true } } },
    }),
    prisma.clientInvoice.findMany({
      where: {
        tenantId,
        ...(projectId ? { projectId } : {}),
        invoiceDate: { gte: fromDate, lte: toDate },
      },
      select: { invoiceDate: true, cgst: true, sgst: true, igst: true },
    }),
  ]);

  const monthMap = new Map<string, { itc: number; output: number }>();

  for (const bill of purchaseBills) {
    const month = bill.invoiceDate.toISOString().slice(0, 7);
    const entry = monthMap.get(month) ?? { itc: 0, output: 0 };
    entry.itc = round2(entry.itc + (isLikelyValidGstin(bill.vendor?.gstin) ? sumTaxAmounts(bill) : 0));
    monthMap.set(month, entry);
  }
  for (const expense of purchaseExpenses) {
    const month = expense.date.toISOString().slice(0, 7);
    const entry = monthMap.get(month) ?? { itc: 0, output: 0 };
    entry.itc = round2(entry.itc + (isLikelyValidGstin(expense.vendor?.gstin) ? sumTaxAmounts(expense) : 0));
    monthMap.set(month, entry);
  }
  for (const invoice of salesInvoices) {
    const month = invoice.invoiceDate.toISOString().slice(0, 7);
    const entry = monthMap.get(month) ?? { itc: 0, output: 0 };
    entry.output = round2(entry.output + sumTaxAmounts(invoice));
    monthMap.set(month, entry);
  }

  const rows: MonthlyItcRow[] = [];
  for (let m = 0; m < 12; m++) {
    const d = new Date(fyYear, 3 + m, 1);
    const month = d.toISOString().slice(0, 7);
    const entry = monthMap.get(month) ?? { itc: 0, output: 0 };
    rows.push({
      month,
      inputTaxCredit: entry.itc,
      outputTax: entry.output,
      netPayable: round2(Math.max(0, entry.output - entry.itc)),
      excessItc: round2(Math.max(0, entry.itc - entry.output)),
    });
  }
  return rows;
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
  const liabilitySummary = await buildGstLiabilitySummary({ tenantId, projectId, from, to });

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
      ...bills.map((bill) => {
        const cgst = round2(Number(bill.cgst));
        const sgst = round2(Number(bill.sgst));
        const igst = round2(Number(bill.igst));
        const partyGstin = bill.vendor.gstin ?? "";
        return {
          id: bill.id,
          date: dateOnly(bill.invoiceDate),
          sourceType: "BILL" as const,
          projectName: bill.project.name,
          partyName: bill.vendor.name,
          partyGstin,
          documentNumber: bill.invoiceNumber,
          gstType: bill.gstType,
          gstRateLabel: rateLabel(bill.gstRate ? Number(bill.gstRate) : null),
          taxableValue: round2(Number(bill.taxableValue)),
          cgst,
          sgst,
          igst,
          total: round2(Number(bill.total)),
          inputTaxCredit: isLikelyValidGstin(partyGstin) ? round2(cgst + sgst + igst) : 0,
          note: [bill.tdsSection, bill.tdsAmount ? `TDS ${round2(Number(bill.tdsAmount))}` : ""].filter(Boolean).join(" • "),
        } satisfies GstRegisterRow;
      }),
      ...expenses.map((expense) => {
        const taxableValue = round2(Number(expense.amountBeforeTax));
        const cgst = round2(Number(expense.cgst));
        const sgst = round2(Number(expense.sgst));
        const igst = round2(Number(expense.igst));
        const inferredRate = inferredExpenseGstRate({ taxableValue, cgst, sgst, igst });
        const partyGstin = expense.vendor?.gstin ?? "";
        return {
          id: expense.id,
          date: dateOnly(expense.date),
          sourceType: "EXPENSE" as const,
          projectName: expense.project.name,
          partyName: expense.vendor?.name ?? expense.labourer?.name ?? expense.expenseType,
          partyGstin,
          documentNumber: `Expense ${expense.id.slice(-6).toUpperCase()}`,
          gstType: inferredExpenseGstType({ cgst, sgst, igst }),
          gstRateLabel: rateLabel(inferredRate),
          taxableValue,
          cgst,
          sgst,
          igst,
          total: round2(Number(expense.totalAmount)),
          inputTaxCredit: isLikelyValidGstin(partyGstin) ? round2(cgst + sgst + igst) : 0,
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
      note: "Combines purchase bills and direct expenses. ITC is counted only where a valid GSTIN is on the vendor/payee row. Expense GST type/rate is inferred from stored tax amounts because the expense model stores components, not GST classification.",
      rows,
      summary,
      liabilitySummary,
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
          { key: "inputTaxCredit", label: "ITC", width: 12, align: "right" },
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
    const cgst = round2(Number(invoice.cgst));
    const sgst = round2(Number(invoice.sgst));
    const igst = round2(Number(invoice.igst));
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
      cgst,
      sgst,
      igst,
      total: round2(Number(invoice.total)),
      outputTax: round2(cgst + sgst + igst),
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
    liabilitySummary,
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
