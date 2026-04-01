import { type ApprovalStatus, Prisma } from "@prisma/client";

import { buildInclusiveDateRange, buildMonthInterval, formatMonthLabel } from "@/lib/date-range";
import { type TabularDataset } from "@/lib/tabular-export";
import { prisma } from "@/server/db";

export type ExportModule =
  | "transactions"
  | "expenses"
  | "wages"
  | "receipts"
  | "invoices"
  | "payments-made"
  | "bills";

type ModuleFilters = {
  tenantId: number;
  projectId?: string;
  from?: string;
  to?: string;
  q?: string;
  approval?: ApprovalStatus;
};

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function combinedText(...parts: Array<string | null | undefined>) {
  return parts.map((part) => part?.trim() ?? "").filter(Boolean).join(" | ");
}

function numberValue(value: Prisma.Decimal | number | null | undefined) {
  return Number(value ?? 0);
}

async function buildTransactionsDataset(filters: ModuleFilters): Promise<TabularDataset> {
  const dateRange = buildInclusiveDateRange(filters.from, filters.to);
  const txns = await prisma.transaction.findMany({
    where: {
      tenantId: filters.tenantId,
      ...(filters.projectId ? { projectId: filters.projectId } : {}),
      ...(dateRange ? { date: dateRange } : {}),
      ...(filters.approval ? { approvalStatus: filters.approval } : {}),
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    include: {
      project: { select: { name: true } },
      category: { select: { name: true } },
      fromAccount: { select: { name: true } },
      toAccount: { select: { name: true } },
    },
  });

  return {
    title: "Transactions",
    filenameBase: "transactions",
    columns: [
      { key: "date", label: "Date", width: 12 },
      { key: "type", label: "Type", width: 14 },
      { key: "project", label: "Project", width: 24 },
      { key: "category", label: "Category", width: 20 },
      { key: "fromAccount", label: "From", width: 18 },
      { key: "toAccount", label: "To", width: 18 },
      { key: "mode", label: "Mode", width: 14 },
      { key: "reference", label: "Reference", width: 18 },
      { key: "approvalStatus", label: "Approval", width: 18 },
      { key: "amount", label: "Amount", width: 14, align: "right" },
      { key: "tdsAmount", label: "TDS", width: 12, align: "right" },
      { key: "narration", label: "Narration", width: 28 },
    ],
    rows: txns.map((txn) => ({
      date: dateOnly(txn.date),
      type: txn.type,
      project: txn.project?.name ?? "",
      category: txn.category?.name ?? "",
      fromAccount: txn.fromAccount?.name ?? "",
      toAccount: txn.toAccount?.name ?? "",
      mode: txn.mode ?? "",
      reference: txn.reference ?? "",
      approvalStatus: txn.approvalStatus,
      amount: numberValue(txn.amount),
      tdsAmount: numberValue(txn.tdsAmount),
      narration: combinedText(txn.note, txn.description),
    })),
  };
}

async function buildExpensesDataset(filters: ModuleFilters): Promise<TabularDataset> {
  const dateRange = buildInclusiveDateRange(filters.from, filters.to);
  const expenses = await prisma.expense.findMany({
    where: {
      tenantId: filters.tenantId,
      ...(filters.projectId ? { projectId: filters.projectId } : {}),
      ...(dateRange ? { date: dateRange } : {}),
      ...(filters.q
        ? {
            OR: [
              { narration: { contains: filters.q, mode: "insensitive" } },
              { vendor: { name: { contains: filters.q, mode: "insensitive" } } },
              { project: { name: { contains: filters.q, mode: "insensitive" } } },
            ],
          }
        : {}),
      ...(filters.approval ? { approvalStatus: filters.approval } : {}),
    },
    include: {
      project: { select: { name: true } },
      vendor: { select: { name: true } },
      labourer: { select: { name: true } },
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  const attachmentCounts =
    expenses.length === 0
      ? []
      : await prisma.attachment.groupBy({
          by: ["entityId"],
          where: { tenantId: filters.tenantId, entityType: "EXPENSE", entityId: { in: expenses.map((expense) => expense.id) } },
          _count: { _all: true },
        });
  const byExpenseId = new Map(attachmentCounts.map((row) => [row.entityId, row._count._all]));

  return {
    title: "Expenses",
    filenameBase: "expenses",
    columns: [
      { key: "date", label: "Date", width: 12 },
      { key: "project", label: "Project", width: 24 },
      { key: "vendor", label: "Vendor", width: 20 },
      { key: "labourer", label: "Labourer", width: 20 },
      { key: "expenseType", label: "Type", width: 16 },
      { key: "amountBeforeTax", label: "Before Tax", width: 14, align: "right" },
      { key: "cgst", label: "CGST", width: 12, align: "right" },
      { key: "sgst", label: "SGST", width: 12, align: "right" },
      { key: "igst", label: "IGST", width: 12, align: "right" },
      { key: "totalAmount", label: "Total", width: 14, align: "right" },
      { key: "paymentMode", label: "Paid Via", width: 14 },
      { key: "approvalStatus", label: "Approval", width: 18 },
      { key: "narration", label: "Narration", width: 28 },
      { key: "billCount", label: "Bills", width: 10, align: "right" },
    ],
    rows: expenses.map((expense) => ({
      date: dateOnly(expense.date),
      project: expense.project.name,
      vendor: expense.vendor?.name ?? "",
      labourer: expense.labourer?.name ?? "",
      expenseType: expense.expenseType,
      amountBeforeTax: numberValue(expense.amountBeforeTax),
      cgst: numberValue(expense.cgst),
      sgst: numberValue(expense.sgst),
      igst: numberValue(expense.igst),
      totalAmount: numberValue(expense.totalAmount),
      paymentMode: expense.paymentMode ?? "",
      approvalStatus: expense.approvalStatus,
      narration: expense.narration ?? "",
      billCount: byExpenseId.get(expense.id) ?? 0,
    })),
  };
}

async function buildWagesDataset(filters: ModuleFilters): Promise<TabularDataset> {
  const dateRange = buildInclusiveDateRange(filters.from, filters.to);
  const sheets = await prisma.labourSheet.findMany({
    where: {
      tenantId: filters.tenantId,
      ...(filters.projectId ? { projectId: filters.projectId } : {}),
      ...(dateRange ? { date: dateRange } : {}),
      ...(filters.approval ? { approvalStatus: filters.approval } : {}),
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      date: true,
      total: true,
      mode: true,
      reference: true,
      note: true,
      approvalStatus: true,
      project: { select: { name: true } },
    },
  });

  const lines =
    sheets.length === 0
      ? []
      : await prisma.labourSheetLine.groupBy({
          by: ["labourSheetId"],
          where: { tenantId: filters.tenantId, labourSheetId: { in: sheets.map((sheet) => sheet.id) } },
          _count: { _all: true },
        });
  const lineCountBySheetId = new Map(lines.map((row) => [row.labourSheetId, row._count._all]));

  return {
    title: "Wages",
    filenameBase: "wages",
    columns: [
      { key: "date", label: "Date", width: 12 },
      { key: "project", label: "Project", width: 24 },
      { key: "total", label: "Total", width: 14, align: "right" },
      { key: "mode", label: "Mode", width: 14 },
      { key: "reference", label: "Reference", width: 16 },
      { key: "approvalStatus", label: "Approval", width: 18 },
      { key: "note", label: "Note", width: 28 },
      { key: "lines", label: "Lines", width: 10, align: "right" },
    ],
    rows: sheets.map((sheet) => ({
      date: dateOnly(sheet.date),
      project: sheet.project.name,
      total: numberValue(sheet.total),
      mode: sheet.mode,
      reference: sheet.reference ?? "",
      approvalStatus: sheet.approvalStatus,
      note: sheet.note ?? "",
      lines: lineCountBySheetId.get(sheet.id) ?? 0,
    })),
  };
}

async function buildReceiptsDataset(filters: ModuleFilters): Promise<TabularDataset> {
  const dateRange = buildInclusiveDateRange(filters.from, filters.to);
  const receipts = await prisma.receipt.findMany({
    where: {
      tenantId: filters.tenantId,
      ...(filters.projectId ? { clientInvoice: { projectId: filters.projectId } } : {}),
      ...(dateRange ? { date: dateRange } : {}),
      ...(filters.approval ? { approvalStatus: filters.approval } : {}),
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      date: true,
      amountReceived: true,
      tdsAmount: true,
      mode: true,
      reference: true,
      remarks: true,
      approvalStatus: true,
      clientInvoice: {
        select: {
          invoiceNumber: true,
          project: { select: { name: true } },
          client: { select: { name: true } },
        },
      },
    },
  });

  return {
    title: "Receipts",
    filenameBase: "receipts",
    columns: [
      { key: "date", label: "Date", width: 12 },
      { key: "invoiceNumber", label: "Invoice #", width: 16 },
      { key: "project", label: "Project", width: 24 },
      { key: "client", label: "Client", width: 24 },
      { key: "amountReceived", label: "Received", width: 14, align: "right" },
      { key: "tdsAmount", label: "TDS", width: 12, align: "right" },
      { key: "grossSettled", label: "Settled", width: 14, align: "right" },
      { key: "mode", label: "Mode", width: 14 },
      { key: "reference", label: "Reference", width: 18 },
      { key: "approvalStatus", label: "Approval", width: 18 },
      { key: "remarks", label: "Remarks", width: 28 },
    ],
    rows: receipts.map((receipt) => {
      const cash = numberValue(receipt.amountReceived);
      const tds = numberValue(receipt.tdsAmount);
      return {
        date: dateOnly(receipt.date),
        invoiceNumber: receipt.clientInvoice.invoiceNumber,
        project: receipt.clientInvoice.project.name,
        client: receipt.clientInvoice.client.name,
        amountReceived: cash,
        tdsAmount: tds,
        grossSettled: cash + tds,
        mode: receipt.mode,
        reference: receipt.reference ?? "",
        approvalStatus: receipt.approvalStatus,
        remarks: receipt.remarks ?? "",
      };
    }),
  };
}

async function buildInvoicesDataset(filters: ModuleFilters): Promise<TabularDataset> {
  const dateRange = buildInclusiveDateRange(filters.from, filters.to);
  const invoices = await prisma.clientInvoice.findMany({
    where: {
      tenantId: filters.tenantId,
      ...(filters.projectId ? { projectId: filters.projectId } : {}),
      ...(dateRange ? { invoiceDate: dateRange } : {}),
    },
    orderBy: [{ invoiceDate: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      invoiceNumber: true,
      invoiceDate: true,
      dueDate: true,
      basicValue: true,
      cgst: true,
      sgst: true,
      igst: true,
      total: true,
      status: true,
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
            tenantId: filters.tenantId,
            documentType: "CLIENT_INVOICE",
            documentId: { in: invoices.map((invoice) => invoice.id) },
          },
          _sum: { cashAmount: true, tdsAmount: true, grossAmount: true },
        });
  const settlementByInvoiceId = new Map(
    settlements.map((row) => [
      row.documentId,
      {
        cash: numberValue(row._sum.cashAmount),
        tds: numberValue(row._sum.tdsAmount),
        gross: numberValue(row._sum.grossAmount),
      },
    ]),
  );

  return {
    title: "Invoices",
    filenameBase: "invoices",
    columns: [
      { key: "invoiceDate", label: "Date", width: 12 },
      { key: "invoiceNumber", label: "Invoice #", width: 16 },
      { key: "dueDate", label: "Due Date", width: 12 },
      { key: "project", label: "Project", width: 24 },
      { key: "client", label: "Client", width: 24 },
      { key: "basicValue", label: "Basic", width: 14, align: "right" },
      { key: "cgst", label: "CGST", width: 12, align: "right" },
      { key: "sgst", label: "SGST", width: 12, align: "right" },
      { key: "igst", label: "IGST", width: 12, align: "right" },
      { key: "total", label: "Total", width: 14, align: "right" },
      { key: "received", label: "Received", width: 14, align: "right" },
      { key: "tds", label: "TDS", width: 12, align: "right" },
      { key: "settled", label: "Settled", width: 14, align: "right" },
      { key: "status", label: "Status", width: 12 },
    ],
    rows: invoices.map((invoice) => {
      const settlement = settlementByInvoiceId.get(invoice.id) ?? { cash: 0, tds: 0, gross: 0 };
      return {
        invoiceDate: dateOnly(invoice.invoiceDate),
        invoiceNumber: invoice.invoiceNumber,
        dueDate: invoice.dueDate ? dateOnly(invoice.dueDate) : "",
        project: invoice.project.name,
        client: invoice.client.name,
        basicValue: numberValue(invoice.basicValue),
        cgst: numberValue(invoice.cgst),
        sgst: numberValue(invoice.sgst),
        igst: numberValue(invoice.igst),
        total: numberValue(invoice.total),
        received: settlement.cash,
        tds: settlement.tds,
        settled: settlement.gross,
        status: invoice.status,
      };
    }),
  };
}

async function buildPaymentsMadeDataset(filters: ModuleFilters): Promise<TabularDataset> {
  const dateRange = buildInclusiveDateRange(filters.from, filters.to);
  const txns = await prisma.transaction.findMany({
    where: {
      tenantId: filters.tenantId,
      type: "EXPENSE",
      vendorId: { not: null },
      ...(filters.projectId ? { projectId: filters.projectId } : {}),
      ...(dateRange ? { date: dateRange } : {}),
      ...(filters.q
        ? {
            OR: [
              { vendor: { name: { contains: filters.q, mode: "insensitive" } } },
              { reference: { contains: filters.q, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(filters.approval ? { approvalStatus: filters.approval } : {}),
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      date: true,
      amount: true,
      tdsAmount: true,
      mode: true,
      reference: true,
      note: true,
      description: true,
      approvalStatus: true,
      vendor: { select: { name: true } },
      project: { select: { name: true } },
    },
  });

  const billCounts =
    txns.length === 0
      ? []
      : await prisma.transactionAllocation.groupBy({
          by: ["transactionId"],
          where: { tenantId: filters.tenantId, transactionId: { in: txns.map((txn) => txn.id) } },
          _count: { _all: true },
        });
  const billCountByTxnId = new Map(billCounts.map((row) => [row.transactionId, row._count._all]));

  return {
    title: "Payments Made",
    filenameBase: "payments-made",
    columns: [
      { key: "date", label: "Date", width: 12 },
      { key: "vendor", label: "Vendor", width: 24 },
      { key: "project", label: "Project", width: 24 },
      { key: "cashPaid", label: "Cash", width: 14, align: "right" },
      { key: "tdsAmount", label: "TDS", width: 12, align: "right" },
      { key: "grossAmount", label: "Gross", width: 14, align: "right" },
      { key: "mode", label: "Mode", width: 14 },
      { key: "reference", label: "Reference", width: 18 },
      { key: "approvalStatus", label: "Approval", width: 18 },
      { key: "narration", label: "Narration", width: 28 },
      { key: "billCount", label: "Bills", width: 10, align: "right" },
    ],
    rows: txns.map((txn) => {
      const cash = numberValue(txn.amount);
      const tds = numberValue(txn.tdsAmount);
      return {
        date: dateOnly(txn.date),
        vendor: txn.vendor?.name ?? "",
        project: txn.project?.name ?? "",
        cashPaid: cash,
        tdsAmount: tds,
        grossAmount: cash + tds,
        mode: txn.mode ?? "",
        reference: txn.reference ?? "",
        approvalStatus: txn.approvalStatus,
        narration: combinedText(txn.note, txn.description),
        billCount: billCountByTxnId.get(txn.id) ?? 0,
      };
    }),
  };
}

async function buildBillsDataset(filters: ModuleFilters): Promise<TabularDataset> {
  const dateRange = buildInclusiveDateRange(filters.from, filters.to);
  const where: Prisma.PurchaseInvoiceWhereInput = {
    tenantId: filters.tenantId,
    ...(filters.projectId ? { projectId: filters.projectId } : {}),
    ...(dateRange ? { invoiceDate: dateRange } : {}),
    ...(filters.approval ? { approvalStatus: filters.approval } : {}),
  };

  if (filters.q) {
    where.OR = [
      { invoiceNumber: { contains: filters.q, mode: "insensitive" } },
      { vendor: { name: { contains: filters.q, mode: "insensitive" } } },
      { project: { name: { contains: filters.q, mode: "insensitive" } } },
    ];
  }

  const bills = await prisma.purchaseInvoice.findMany({
    where,
    orderBy: [{ invoiceDate: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      invoiceNumber: true,
      invoiceDate: true,
      taxableValue: true,
      cgst: true,
      sgst: true,
      igst: true,
      total: true,
      tdsApplicable: true,
      tdsSection: true,
      tdsRate: true,
      tdsAmount: true,
      netPayable: true,
      approvalStatus: true,
      vendor: { select: { name: true } },
      project: { select: { name: true } },
    },
  });

  const payments =
    bills.length === 0
      ? []
      : await prisma.transactionAllocation.groupBy({
          by: ["documentId"],
          where: {
            tenantId: filters.tenantId,
            documentType: "PURCHASE_INVOICE",
            documentId: { in: bills.map((bill) => bill.id) },
          },
          _sum: { grossAmount: true },
        });
  const paidByBillId = new Map(payments.map((row) => [row.documentId, numberValue(row._sum.grossAmount)]));

  return {
    title: "Bills",
    filenameBase: "bills",
    columns: [
      { key: "invoiceDate", label: "Date", width: 12 },
      { key: "invoiceNumber", label: "Bill #", width: 16 },
      { key: "vendor", label: "Vendor", width: 24 },
      { key: "project", label: "Project", width: 24 },
      { key: "taxableValue", label: "Taxable", width: 14, align: "right" },
      { key: "cgst", label: "CGST", width: 12, align: "right" },
      { key: "sgst", label: "SGST", width: 12, align: "right" },
      { key: "igst", label: "IGST", width: 12, align: "right" },
      { key: "total", label: "Total", width: 14, align: "right" },
      { key: "tdsApplicable", label: "TDS?", width: 10 },
      { key: "tdsAmount", label: "Bill TDS", width: 12, align: "right" },
      { key: "netPayable", label: "Net Payable", width: 14, align: "right" },
      { key: "approvalStatus", label: "Approval", width: 18 },
      { key: "paid", label: "Paid", width: 14, align: "right" },
      { key: "balance", label: "Balance", width: 14, align: "right" },
    ],
    rows: bills.map((bill) => {
      const paid = paidByBillId.get(bill.id) ?? 0;
      const total = numberValue(bill.total);
      return {
        invoiceDate: dateOnly(bill.invoiceDate),
        invoiceNumber: bill.invoiceNumber,
        vendor: bill.vendor.name,
        project: bill.project.name,
        taxableValue: numberValue(bill.taxableValue),
        cgst: numberValue(bill.cgst),
        sgst: numberValue(bill.sgst),
        igst: numberValue(bill.igst),
        total,
        tdsApplicable: bill.tdsApplicable ? "YES" : "NO",
        tdsAmount: numberValue(bill.tdsAmount),
        netPayable: numberValue(bill.netPayable),
        approvalStatus: bill.approvalStatus,
        paid,
        balance: Math.max(0, total - paid),
      };
    }),
  };
}

export async function buildModuleDataset(module: ExportModule, filters: ModuleFilters): Promise<TabularDataset> {
  if (module === "transactions") return buildTransactionsDataset(filters);
  if (module === "expenses") return buildExpensesDataset(filters);
  if (module === "wages") return buildWagesDataset(filters);
  if (module === "receipts") return buildReceiptsDataset(filters);
  if (module === "invoices") return buildInvoicesDataset(filters);
  if (module === "payments-made") return buildPaymentsMadeDataset(filters);
  return buildBillsDataset(filters);
}

export async function buildMonthlyOutflowDataset({
  tenantId,
  projectId,
  month,
}: {
  tenantId: number;
  projectId?: string;
  month: string;
}): Promise<TabularDataset> {
  const { start, end } = buildMonthInterval(month);
  const monthLabel = formatMonthLabel(month);

  const [bills, expenses, wages, payments] = await Promise.all([
    prisma.purchaseInvoice.findMany({
      where: {
        tenantId,
        invoiceDate: { gte: start, lt: end },
        ...(projectId ? { projectId } : {}),
      },
      include: {
        vendor: { select: { name: true } },
        project: { select: { name: true } },
      },
      orderBy: [{ invoiceDate: "asc" }, { createdAt: "asc" }],
    }),
    prisma.expense.findMany({
      where: {
        tenantId,
        date: { gte: start, lt: end },
        ...(projectId ? { projectId } : {}),
      },
      include: {
        project: { select: { name: true } },
        vendor: { select: { name: true } },
        labourer: { select: { name: true } },
      },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    }),
    prisma.labourSheet.findMany({
      where: {
        tenantId,
        date: { gte: start, lt: end },
        ...(projectId ? { projectId } : {}),
      },
      include: {
        project: { select: { name: true } },
      },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    }),
    prisma.transaction.findMany({
      where: {
        tenantId,
        type: "EXPENSE",
        vendorId: { not: null },
        date: { gte: start, lt: end },
        ...(projectId ? { projectId } : {}),
      },
      include: {
        project: { select: { name: true } },
        vendor: { select: { name: true } },
      },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  const [expenseAttachments, wageLines, billPayments, paymentBills] = await Promise.all([
    expenses.length === 0
      ? []
      : prisma.attachment.groupBy({
          by: ["entityId"],
          where: { tenantId, entityType: "EXPENSE", entityId: { in: expenses.map((expense) => expense.id) } },
          _count: { _all: true },
        }),
    wages.length === 0
      ? []
      : prisma.labourSheetLine.groupBy({
          by: ["labourSheetId"],
          where: { tenantId, labourSheetId: { in: wages.map((sheet) => sheet.id) } },
          _count: { _all: true },
        }),
    bills.length === 0
      ? []
      : prisma.transactionAllocation.groupBy({
          by: ["documentId"],
          where: { tenantId, documentType: "PURCHASE_INVOICE", documentId: { in: bills.map((bill) => bill.id) } },
          _count: { _all: true },
        }),
    payments.length === 0
      ? []
      : prisma.transactionAllocation.groupBy({
          by: ["transactionId"],
          where: { tenantId, transactionId: { in: payments.map((payment) => payment.id) } },
          _count: { _all: true },
        }),
  ]);

  const attachmentCountByExpenseId = new Map(expenseAttachments.map((row) => [row.entityId, row._count._all]));
  const lineCountByWageId = new Map(wageLines.map((row) => [row.labourSheetId, row._count._all]));
  const paymentCountByBillId = new Map(billPayments.map((row) => [row.documentId, row._count._all]));
  const billCountByPaymentId = new Map(paymentBills.map((row) => [row.transactionId, row._count._all]));

  const rows = [
    ...bills.map((bill) => ({
      sortDate: bill.invoiceDate,
      createdAt: bill.createdAt,
      values: {
        entryType: "BILL_BOOKED",
        approvalStatus: bill.approvalStatus,
        date: dateOnly(bill.invoiceDate),
        project: bill.project.name,
        party: bill.vendor.name,
        documentNo: bill.invoiceNumber,
        category: "PURCHASE_INVOICE",
        amountBeforeTax: numberValue(bill.taxableValue),
        cgst: numberValue(bill.cgst),
        sgst: numberValue(bill.sgst),
        igst: numberValue(bill.igst),
        totalAmount: numberValue(bill.total),
        cashAmount: "",
        tdsAmount: numberValue(bill.tdsAmount),
        grossAmount: "",
        mode: "",
        reference: "",
        narration: "",
        linkedCount: paymentCountByBillId.get(bill.id) ?? 0,
      },
    })),
    ...expenses.map((expense) => ({
      sortDate: expense.date,
      createdAt: expense.createdAt,
      values: {
        entryType: "EXPENSE_ADDED",
        approvalStatus: expense.approvalStatus,
        date: dateOnly(expense.date),
        project: expense.project.name,
        party: expense.vendor?.name ?? expense.labourer?.name ?? "",
        documentNo: "",
        category: expense.expenseType,
        amountBeforeTax: numberValue(expense.amountBeforeTax),
        cgst: numberValue(expense.cgst),
        sgst: numberValue(expense.sgst),
        igst: numberValue(expense.igst),
        totalAmount: numberValue(expense.totalAmount),
        cashAmount: "",
        tdsAmount: "",
        grossAmount: "",
        mode: expense.paymentMode ?? "",
        reference: "",
        narration: expense.narration ?? "",
        linkedCount: attachmentCountByExpenseId.get(expense.id) ?? 0,
      },
    })),
    ...wages.map((sheet) => ({
      sortDate: sheet.date,
      createdAt: sheet.createdAt,
      values: {
        entryType: "WAGE_SHEET",
        approvalStatus: sheet.approvalStatus,
        date: dateOnly(sheet.date),
        project: sheet.project.name,
        party: "",
        documentNo: "",
        category: "WAGES",
        amountBeforeTax: numberValue(sheet.total),
        cgst: "",
        sgst: "",
        igst: "",
        totalAmount: numberValue(sheet.total),
        cashAmount: "",
        tdsAmount: 0,
        grossAmount: "",
        mode: sheet.mode,
        reference: sheet.reference ?? "",
        narration: sheet.note ?? "",
        linkedCount: lineCountByWageId.get(sheet.id) ?? 0,
      },
    })),
    ...payments.map((payment) => {
      const cash = numberValue(payment.amount);
      const tds = numberValue(payment.tdsAmount);
      return {
        sortDate: payment.date,
        createdAt: payment.createdAt,
        values: {
          entryType: "PAYMENT_MADE",
          approvalStatus: payment.approvalStatus,
          date: dateOnly(payment.date),
          project: payment.project?.name ?? "",
          party: payment.vendor?.name ?? "",
          documentNo: "",
          category: "PAYMENT",
          amountBeforeTax: "",
          cgst: "",
          sgst: "",
          igst: "",
          totalAmount: "",
          cashAmount: cash,
          tdsAmount: tds,
          grossAmount: cash + tds,
          mode: payment.mode ?? "",
          reference: payment.reference ?? "",
          narration: combinedText(payment.note, payment.description),
          linkedCount: billCountByPaymentId.get(payment.id) ?? 0,
        },
      };
    }),
  ].sort((left, right) => {
    const dateDiff = left.sortDate.getTime() - right.sortDate.getTime();
    if (dateDiff !== 0) return dateDiff;
    return left.createdAt.getTime() - right.createdAt.getTime();
  });

  return {
    title: `Monthly Outflow Register - ${monthLabel}`,
    filenameBase: `monthly-outflows-${month}`,
    columns: [
      { key: "entryType", label: "EntryType", width: 16 },
      { key: "approvalStatus", label: "Approval", width: 18 },
      { key: "date", label: "Date", width: 12 },
      { key: "project", label: "Project", width: 24 },
      { key: "party", label: "Party", width: 22 },
      { key: "documentNo", label: "Document #", width: 18 },
      { key: "category", label: "Category", width: 18 },
      { key: "amountBeforeTax", label: "Before Tax", width: 14, align: "right" },
      { key: "cgst", label: "CGST", width: 12, align: "right" },
      { key: "sgst", label: "SGST", width: 12, align: "right" },
      { key: "igst", label: "IGST", width: 12, align: "right" },
      { key: "totalAmount", label: "Total", width: 14, align: "right" },
      { key: "cashAmount", label: "Cash", width: 14, align: "right" },
      { key: "tdsAmount", label: "TDS", width: 12, align: "right" },
      { key: "grossAmount", label: "Gross", width: 14, align: "right" },
      { key: "mode", label: "Mode", width: 14 },
      { key: "reference", label: "Reference", width: 16 },
      { key: "narration", label: "Narration", width: 28 },
      { key: "linkedCount", label: "Linked Count", width: 12, align: "right" },
    ],
    rows: rows.map((row) => row.values),
  };
}
