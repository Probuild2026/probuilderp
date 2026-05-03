import { Prisma, type ApprovalStatus, type PaymentMode } from "@prisma/client";

import { prisma } from "@/server/db";

type LedgerType = "INCOME" | "EXPENSE" | "TRANSFER";

type DateRange = {
  gte?: Date;
  gt?: Date;
  lte?: Date;
  lt?: Date;
};

export type CashLedgerSort = "date-desc" | "date-asc" | "amount-desc" | "amount-asc";

export type CashLedgerRow = {
  id: string;
  sourceId: string;
  sourceLabel: string;
  sourceHref: string;
  type: LedgerType;
  date: Date;
  createdAt: Date;
  amount: Prisma.Decimal;
  tdsAmount: Prisma.Decimal;
  projectName: string | null;
  categoryName: string | null;
  fromAccountName: string | null;
  toAccountName: string | null;
  mode: PaymentMode | null;
  reference: string | null;
  approvalStatus: ApprovalStatus | null;
  note: string | null;
  description: string | null;
};

export type CashLedgerFilters = {
  tenantId: number;
  projectId?: string;
  vendorId?: string;
  dateRange?: DateRange;
  categoryId?: string;
  approval?: ApprovalStatus;
  sort?: CashLedgerSort;
  limit?: number;
  offset?: number;
};

export type CashLedgerTotals = {
  income: number;
  expense: number;
  transfer: number;
  partner: number;
};

const ZERO = new Prisma.Decimal(0);

function zero() {
  return new Prisma.Decimal(0);
}

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function paymentModeAccountName(mode: PaymentMode | null | undefined) {
  if (!mode) return null;
  if (mode === "CASH") return "Cash";
  if (mode === "UPI") return "UPI";
  if (mode === "CARD") return "Card";
  if (mode === "BANK_TRANSFER" || mode === "CHEQUE") return "Bank";
  return "Other";
}

function expenseTypeLabel(value: string) {
  if (value === "MATERIAL") return "Material";
  if (value === "LABOUR") return "Labour";
  if (value === "SUBCONTRACTOR") return "Subcontractor";
  if (value === "OVERHEAD") return "Overhead";
  return value;
}

function partnerRemunerationLabel(value: string) {
  if (value === "SALARY") return "Partner Salary";
  if (value === "BONUS") return "Partner Bonus";
  if (value === "COMMISSION") return "Partner Commission";
  return "Partner Remuneration";
}

function compareDates(left: CashLedgerRow, right: CashLedgerRow, direction: "asc" | "desc") {
  const dateDiff = left.date.getTime() - right.date.getTime();
  if (dateDiff !== 0) return direction === "asc" ? dateDiff : -dateDiff;

  const createdDiff = left.createdAt.getTime() - right.createdAt.getTime();
  if (createdDiff !== 0) return direction === "asc" ? createdDiff : -createdDiff;

  return left.sourceId.localeCompare(right.sourceId);
}

export function sortCashLedgerRows(rows: CashLedgerRow[], sort: CashLedgerSort = "date-desc") {
  return [...rows].sort((left, right) => {
    if (sort === "date-asc") return compareDates(left, right, "asc");
    if (sort === "amount-desc") {
      const diff = Number(right.amount) - Number(left.amount);
      return diff || compareDates(left, right, "desc");
    }
    if (sort === "amount-asc") {
      const diff = Number(left.amount) - Number(right.amount);
      return diff || compareDates(left, right, "desc");
    }
    return compareDates(left, right, "desc");
  });
}

function applyLimit(rows: CashLedgerRow[], limit?: number, offset = 0) {
  return limit ? rows.slice(offset, offset + limit) : rows;
}

export function summarizeCashLedgerRows(rows: CashLedgerRow[]): CashLedgerTotals {
  return rows.reduce(
    (acc, row) => {
      const amount = Number(row.amount);
      if (row.type === "INCOME") acc.income += amount;
      if (row.type === "EXPENSE") acc.expense += amount;
      if (row.type === "TRANSFER") acc.transfer += amount;
      if (row.sourceLabel.includes("Partner")) acc.partner += amount;
      return acc;
    },
    { income: 0, expense: 0, transfer: 0, partner: 0 },
  );
}

function transactionSource(row: {
  id: string;
  type: LedgerType;
  vendorId: string | null;
  receipts: Array<{ id: string }>;
  labourSheet: { id: string } | null;
}) {
  const receipt = row.receipts[0];
  if (receipt) {
    return {
      label: "Receipt",
      href: `/app/sales/receipts/${receipt.id}`,
    };
  }

  if (row.labourSheet) {
    return {
      label: "Wages",
      href: `/app/wages/${row.labourSheet.id}`,
    };
  }

  if (row.type === "EXPENSE" && row.vendorId) {
    return {
      label: "Payment Made",
      href: `/app/purchases/payments-made/${row.id}`,
    };
  }

  if (row.type === "TRANSFER") {
    return {
      label: "Transfer",
      href: `/app/transactions/${row.id}`,
    };
  }

  return {
    label: "Transaction",
    href: `/app/transactions/${row.id}`,
  };
}

async function transactionRows(filters: CashLedgerFilters): Promise<CashLedgerRow[]> {
  const rows = await prisma.transaction.findMany({
    where: {
      tenantId: filters.tenantId,
      ...(filters.projectId ? { projectId: filters.projectId } : {}),
      ...(filters.vendorId ? { vendorId: filters.vendorId } : {}),
      ...(filters.dateRange ? { date: filters.dateRange } : {}),
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(filters.approval ? { approvalStatus: filters.approval } : {}),
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    include: {
      project: { select: { name: true } },
      category: { select: { name: true } },
      fromAccount: { select: { name: true } },
      toAccount: { select: { name: true } },
      receipts: { select: { id: true }, take: 1 },
      labourSheet: { select: { id: true } },
    },
  });

  return rows.map((row) => {
    const source = transactionSource({
      id: row.id,
      type: row.type,
      vendorId: row.vendorId,
      receipts: row.receipts,
      labourSheet: row.labourSheet,
    });

    return {
      id: `transaction:${row.id}`,
      sourceId: row.id,
      sourceLabel: source.label,
      sourceHref: source.href,
      type: row.type,
      date: row.date,
      createdAt: row.createdAt,
      amount: row.amount,
      tdsAmount: row.tdsAmount ?? zero(),
      projectName: row.project?.name ?? null,
      categoryName: row.category?.name ?? row.type,
      fromAccountName: row.fromAccount?.name ?? null,
      toAccountName: row.toAccount?.name ?? null,
      mode: row.mode,
      reference: row.reference,
      approvalStatus: row.approvalStatus,
      note: row.note,
      description: row.description,
    };
  });
}

async function directExpenseRows(filters: CashLedgerFilters): Promise<CashLedgerRow[]> {
  if (filters.categoryId) return [];

  const expenses = await prisma.expense.findMany({
    where: {
      tenantId: filters.tenantId,
      paymentMode: { not: null },
      ...(filters.projectId ? { projectId: filters.projectId } : {}),
      ...(filters.vendorId ? { vendorId: filters.vendorId } : {}),
      ...(filters.dateRange ? { date: filters.dateRange } : {}),
      ...(filters.approval ? { approvalStatus: filters.approval } : {}),
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    include: {
      project: { select: { name: true } },
    },
  });

  if (expenses.length === 0) return [];

  const allocated = await prisma.transactionAllocation.findMany({
    where: {
      tenantId: filters.tenantId,
      documentType: "EXPENSE",
      documentId: { in: expenses.map((expense) => expense.id) },
    },
    select: { documentId: true },
  });
  const allocatedExpenseIds = new Set(allocated.map((row) => row.documentId));

  return expenses
    .filter((expense) => !allocatedExpenseIds.has(expense.id))
    .map((expense) => ({
      id: `expense:${expense.id}`,
      sourceId: expense.id,
      sourceLabel: "Expense",
      sourceHref: `/app/expenses/${expense.id}`,
      type: "EXPENSE" as const,
      date: expense.date,
      createdAt: expense.createdAt,
      amount: expense.totalAmount,
      tdsAmount: ZERO,
      projectName: expense.project.name,
      categoryName: expenseTypeLabel(expense.expenseType),
      fromAccountName: paymentModeAccountName(expense.paymentMode),
      toAccountName: null,
      mode: expense.paymentMode,
      reference: null,
      approvalStatus: expense.approvalStatus,
      note: expense.narration,
      description: null,
    }));
}

async function unlinkedReceiptRows(filters: CashLedgerFilters): Promise<CashLedgerRow[]> {
  if (filters.categoryId || filters.vendorId) return [];

  const receipts = await prisma.receipt.findMany({
    where: {
      tenantId: filters.tenantId,
      transactionId: null,
      ...(filters.projectId ? { clientInvoice: { projectId: filters.projectId } } : {}),
      ...(filters.dateRange ? { date: filters.dateRange } : {}),
      ...(filters.approval ? { approvalStatus: filters.approval } : {}),
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    include: {
      clientInvoice: {
        select: {
          invoiceNumber: true,
          project: { select: { name: true } },
        },
      },
    },
  });

  return receipts.map((receipt) => ({
    id: `receipt:${receipt.id}`,
    sourceId: receipt.id,
    sourceLabel: "Receipt",
    sourceHref: `/app/sales/receipts/${receipt.id}`,
    type: "INCOME" as const,
    date: receipt.date,
    createdAt: receipt.createdAt,
    amount: receipt.amountReceived,
    tdsAmount: receipt.tdsAmount ?? zero(),
    projectName: receipt.clientInvoice.project.name,
    categoryName: "Payment from Client",
    fromAccountName: null,
    toAccountName: paymentModeAccountName(receipt.mode),
    mode: receipt.mode,
    reference: receipt.reference,
    approvalStatus: receipt.approvalStatus,
    note: `Receipt for invoice ${receipt.clientInvoice.invoiceNumber}`,
    description: receipt.remarks,
  }));
}

async function unlinkedWageRows(filters: CashLedgerFilters): Promise<CashLedgerRow[]> {
  if (filters.categoryId || filters.vendorId) return [];

  const sheets = await prisma.labourSheet.findMany({
    where: {
      tenantId: filters.tenantId,
      transactionId: null,
      ...(filters.projectId ? { projectId: filters.projectId } : {}),
      ...(filters.dateRange ? { date: filters.dateRange } : {}),
      ...(filters.approval ? { approvalStatus: filters.approval } : {}),
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    include: {
      project: { select: { name: true } },
    },
  });

  return sheets.map((sheet) => ({
    id: `wage:${sheet.id}`,
    sourceId: sheet.id,
    sourceLabel: "Wages",
    sourceHref: `/app/wages/${sheet.id}`,
    type: "EXPENSE" as const,
    date: sheet.date,
    createdAt: sheet.createdAt,
    amount: sheet.total,
    tdsAmount: ZERO,
    projectName: sheet.project.name,
    categoryName: "Labour Payment",
    fromAccountName: paymentModeAccountName(sheet.mode),
    toAccountName: null,
    mode: sheet.mode,
    reference: sheet.reference,
    approvalStatus: sheet.approvalStatus,
    note: sheet.note,
    description: null,
  }));
}

async function partnerRows(filters: CashLedgerFilters): Promise<CashLedgerRow[]> {
  if (filters.categoryId || filters.vendorId || filters.approval) return [];

  const [remunerations, drawings, partnerTdsPayments] = await Promise.all([
    prisma.partnerRemuneration.findMany({
      where: {
        tenantId: filters.tenantId,
        paymentMode: { not: null },
        ...(filters.projectId ? { projectId: filters.projectId } : {}),
        ...(filters.dateRange
          ? {
              OR: [
                { paymentDate: filters.dateRange },
                { paymentDate: null, date: filters.dateRange },
              ],
            }
          : {}),
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      include: {
        partner: { select: { name: true } },
        project: { select: { name: true } },
      },
    }),
    prisma.partnerDrawing.findMany({
      where: {
        tenantId: filters.tenantId,
        ...(filters.projectId ? { projectId: filters.projectId } : {}),
        ...(filters.dateRange ? { date: filters.dateRange } : {}),
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      include: {
        partner: { select: { name: true } },
        project: { select: { name: true } },
      },
    }),
    filters.projectId
      ? Promise.resolve([])
      : prisma.partnerTdsPayment.findMany({
          where: {
            tenantId: filters.tenantId,
            ...(filters.dateRange ? { paymentDate: filters.dateRange } : {}),
          },
          orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }],
          include: {
            partner: { select: { name: true } },
          },
        }),
  ]);

  return [
    ...remunerations.map((row) => {
      const paymentDate = row.paymentDate ?? row.date;
      return {
        id: `partner-remuneration:${row.id}`,
        sourceId: row.id,
        sourceLabel: "Partner Remuneration",
        sourceHref: `/app/partners/${row.partnerId}`,
        type: "EXPENSE" as const,
        date: paymentDate,
        createdAt: row.createdAt,
        amount: row.netPayable,
        tdsAmount: row.tdsAmount ?? zero(),
        projectName: row.project?.name ?? null,
        categoryName: partnerRemunerationLabel(row.type),
        fromAccountName: paymentModeAccountName(row.paymentMode),
        toAccountName: null,
        mode: row.paymentMode,
        reference: null,
        approvalStatus: null,
        note: row.partner.name,
        description: row.note,
      };
    }),
    ...drawings.map((row) => ({
      id: `partner-drawing:${row.id}`,
      sourceId: row.id,
      sourceLabel: "Partner Drawing",
      sourceHref: `/app/partners/${row.partnerId}`,
      type: "EXPENSE" as const,
      date: row.date,
      createdAt: row.createdAt,
      amount: row.amount,
      tdsAmount: ZERO,
      projectName: row.project?.name ?? null,
      categoryName: "Partner Drawing",
      fromAccountName: paymentModeAccountName(row.mode),
      toAccountName: null,
      mode: row.mode,
      reference: null,
      approvalStatus: null,
      note: row.partner.name,
      description: row.note,
    })),
    ...partnerTdsPayments.map((row) => ({
      id: `partner-tds:${row.id}`,
      sourceId: row.id,
      sourceLabel: "Partner TDS Payment",
      sourceHref: `/app/partners/${row.partnerId}`,
      type: "EXPENSE" as const,
      date: row.paymentDate,
      createdAt: row.createdAt,
      amount: row.tdsPaidAmount,
      tdsAmount: ZERO,
      projectName: null,
      categoryName: `TDS ${row.section}`,
      fromAccountName: "Bank",
      toAccountName: null,
      mode: null,
      reference: row.challanNo,
      approvalStatus: null,
      note: row.partner.name,
      description: row.note,
    })),
  ];
}

async function vendorTdsRows(filters: CashLedgerFilters): Promise<CashLedgerRow[]> {
  if (filters.projectId || filters.categoryId || filters.approval) return [];

  const rows = await prisma.vendorTdsPayment.findMany({
    where: {
      tenantId: filters.tenantId,
      ...(filters.vendorId ? { vendorId: filters.vendorId } : {}),
      ...(filters.dateRange ? { paymentDate: filters.dateRange } : {}),
    },
    orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }],
    include: {
      vendor: { select: { name: true } },
    },
  });

  return rows.map((row) => ({
    id: `vendor-tds:${row.id}`,
    sourceId: row.id,
    sourceLabel: "Vendor TDS Payment",
    sourceHref: "/app/reports/tds-dashboard",
    type: "EXPENSE" as const,
    date: row.paymentDate,
    createdAt: row.createdAt,
    amount: row.tdsPaidAmount,
    tdsAmount: ZERO,
    projectName: null,
    categoryName: `TDS ${row.section}`,
    fromAccountName: "Bank",
    toAccountName: null,
    mode: null,
    reference: row.challanNo,
    approvalStatus: null,
    note: row.vendor.name,
    description: row.note,
  }));
}

async function legacyVendorPaymentRows(filters: CashLedgerFilters): Promise<CashLedgerRow[]> {
  if (filters.categoryId || filters.approval) return [];

  const payments = await prisma.vendorPayment.findMany({
    where: {
      tenantId: filters.tenantId,
      ...(filters.vendorId ? { vendorId: filters.vendorId } : {}),
      ...(filters.dateRange ? { date: filters.dateRange } : {}),
      ...(filters.projectId ? { purchaseInvoice: { projectId: filters.projectId } } : {}),
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    include: {
      vendor: { select: { name: true } },
      purchaseInvoice: {
        select: {
          invoiceNumber: true,
          project: { select: { name: true } },
        },
      },
    },
  });

  if (payments.length === 0) return [];

  const possibleDuplicates = await prisma.transaction.findMany({
    where: {
      tenantId: filters.tenantId,
      type: "EXPENSE",
      vendorId: { in: [...new Set(payments.map((payment) => payment.vendorId))] },
      date: { in: [...new Set(payments.map((payment) => payment.date))] },
    },
    select: {
      vendorId: true,
      date: true,
      amount: true,
      mode: true,
      reference: true,
    },
  });

  const transactionKeys = new Set(
    possibleDuplicates.map((row) => {
      return [
        row.vendorId ?? "",
        dateOnly(row.date),
        row.amount.toString(),
        row.mode ?? "",
        row.reference ?? "",
      ].join("|");
    }),
  );

  return payments
    .filter((payment) => {
      const key = [
        payment.vendorId,
        dateOnly(payment.date),
        payment.amountPaid.toString(),
        payment.mode,
        payment.reference ?? "",
      ].join("|");
      return !transactionKeys.has(key);
    })
    .map((payment) => ({
      id: `legacy-vendor-payment:${payment.id}`,
      sourceId: payment.id,
      sourceLabel: "Payment Made",
      sourceHref: `/app/vendors/${payment.vendorId}`,
      type: "EXPENSE" as const,
      date: payment.date,
      createdAt: payment.createdAt,
      amount: payment.amountPaid,
      tdsAmount: payment.tdsAmount ?? zero(),
      projectName: payment.purchaseInvoice?.project.name ?? null,
      categoryName: "Vendor Payment",
      fromAccountName: paymentModeAccountName(payment.mode),
      toAccountName: null,
      mode: payment.mode,
      reference: payment.reference,
      approvalStatus: null,
      note: payment.vendor.name,
      description: payment.remarks ?? payment.purchaseInvoice?.invoiceNumber ?? null,
    }));
}

async function buildCashLedgerRows(filters: CashLedgerFilters) {
  return (
    await Promise.all([
      transactionRows(filters),
      directExpenseRows(filters),
      unlinkedReceiptRows(filters),
      unlinkedWageRows(filters),
      partnerRows(filters),
      vendorTdsRows(filters),
      legacyVendorPaymentRows(filters),
    ])
  ).flat();
}

export async function getCashLedgerRows(filters: CashLedgerFilters) {
  const rows = await buildCashLedgerRows(filters);
  return applyLimit(sortCashLedgerRows(rows, filters.sort), filters.limit, filters.offset);
}

export async function getCashLedgerPage(filters: CashLedgerFilters & { limit: number; offset?: number }) {
  const rows = sortCashLedgerRows(await buildCashLedgerRows(filters), filters.sort);

  return {
    rows: applyLimit(rows, filters.limit, filters.offset),
    totalRows: rows.length,
    sourceCount: new Set(rows.map((row) => row.sourceLabel)).size,
    totals: summarizeCashLedgerRows(rows),
  };
}
