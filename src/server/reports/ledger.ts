import { startOfDayUtc, endOfDayUtc } from "@/lib/date-range";
import { type TabularDataset } from "@/lib/tabular-export";
import { prisma } from "@/server/db";

export type LedgerKind = "client" | "vendor";

export type LedgerEntryType = "OPENING_BALANCE" | "INVOICE" | "RECEIPT" | "BILL" | "PAYMENT";

export type LedgerRow = {
  id: string;
  date: string;
  type: LedgerEntryType;
  projectName: string;
  partyName: string;
  documentNumber: string;
  reference: string;
  mode: string;
  note: string;
  increaseAmount: number;
  decreaseAmount: number;
  runningBalance: number;
};

export type LedgerReport = {
  kind: LedgerKind;
  title: string;
  from: string;
  to: string;
  note?: string;
  partyLabel: string;
  increaseLabel: string;
  decreaseLabel: string;
  balanceLabel: string;
  openingBalance: number;
  totalIncrease: number;
  totalDecrease: number;
  closingBalance: number;
  rows: LedgerRow[];
  dataset: TabularDataset;
};

type BaseLedgerEntry = Omit<LedgerRow, "date" | "runningBalance"> & {
  date: Date;
  sortValue: string;
};

const entryTypeLabel: Record<LedgerEntryType, string> = {
  OPENING_BALANCE: "Opening balance",
  INVOICE: "Invoice",
  RECEIPT: "Receipt",
  BILL: "Bill",
  PAYMENT: "Payment",
};

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function round2(value: number) {
  return Number(value.toFixed(2));
}

function combinedText(...parts: Array<string | null | undefined>) {
  return parts.map((part) => part?.trim() ?? "").filter(Boolean).join(" | ");
}

function periodLabel(from?: string, to?: string) {
  if (from && to) return `${from}-to-${to}`;
  if (from) return `from-${from}`;
  if (to) return `upto-${to}`;
  return "all-time";
}

function compareEntries(left: BaseLedgerEntry, right: BaseLedgerEntry) {
  const byDate = left.date.getTime() - right.date.getTime();
  if (byDate !== 0) return byDate;

  const leftRank = left.type === "INVOICE" || left.type === "BILL" ? 0 : 1;
  const rightRank = right.type === "INVOICE" || right.type === "BILL" ? 0 : 1;
  if (leftRank !== rightRank) return leftRank - rightRank;

  return left.sortValue.localeCompare(right.sortValue);
}

function withinRange(value: Date, from?: string, to?: string) {
  if (from && value < startOfDayUtc(from)) return false;
  if (to && value > endOfDayUtc(to)) return false;
  return true;
}

function beforeRange(value: Date, from?: string) {
  return Boolean(from) && value < startOfDayUtc(from!);
}

function buildExportRows(report: Omit<LedgerReport, "dataset">) {
  const openingRow = report.from
    ? [
        {
          date: report.from,
          typeLabel: entryTypeLabel.OPENING_BALANCE,
          projectName: "",
          partyName: "",
          documentNumber: "Opening balance",
          reference: "",
          mode: "",
          note: "",
          increaseAmount: "",
          decreaseAmount: "",
          runningBalance: report.openingBalance,
        },
      ]
    : [];

  return [
    ...openingRow,
    ...report.rows.map((row) => ({
      date: row.date,
      typeLabel: entryTypeLabel[row.type],
      projectName: row.projectName,
      partyName: row.partyName,
      documentNumber: row.documentNumber,
      reference: row.reference,
      mode: row.mode,
      note: row.note,
      increaseAmount: row.increaseAmount || "",
      decreaseAmount: row.decreaseAmount || "",
      runningBalance: row.runningBalance,
    })),
  ];
}

async function buildClientLedgerEntries({
  tenantId,
  projectId,
  to,
}: {
  tenantId: number;
  projectId?: string;
  to?: string;
}) {
  const invoices = await prisma.clientInvoice.findMany({
    where: {
      tenantId,
      ...(projectId ? { projectId } : {}),
      ...(to ? { invoiceDate: { lte: endOfDayUtc(to) } } : {}),
    },
    orderBy: [{ invoiceDate: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      invoiceNumber: true,
      invoiceDate: true,
      total: true,
      serviceDescription: true,
      project: { select: { name: true } },
      client: { select: { name: true } },
    },
  });

  const receipts = await prisma.receipt.findMany({
    where: {
      tenantId,
      ...(projectId ? { clientInvoice: { projectId } } : {}),
      ...(to ? { date: { lte: endOfDayUtc(to) } } : {}),
    },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      date: true,
      amountReceived: true,
      tdsAmount: true,
      mode: true,
      reference: true,
      remarks: true,
      clientInvoice: {
        select: {
          invoiceNumber: true,
          project: { select: { name: true } },
          client: { select: { name: true } },
        },
      },
    },
  });

  const entries: BaseLedgerEntry[] = [
    ...invoices.map((invoice) => ({
      id: invoice.id,
      date: invoice.invoiceDate,
      type: "INVOICE" as const,
      projectName: invoice.project.name,
      partyName: invoice.client.name,
      documentNumber: invoice.invoiceNumber,
      reference: "",
      mode: "",
      note: invoice.serviceDescription ?? "",
      increaseAmount: round2(Number(invoice.total)),
      decreaseAmount: 0,
      sortValue: `${dateOnly(invoice.invoiceDate)}|invoice|${invoice.invoiceNumber}|${invoice.id}`,
    })),
    ...receipts.map((receipt) => ({
      id: receipt.id,
      date: receipt.date,
      type: "RECEIPT" as const,
      projectName: receipt.clientInvoice.project.name,
      partyName: receipt.clientInvoice.client.name,
      documentNumber: receipt.clientInvoice.invoiceNumber,
      reference: receipt.reference ?? "",
      mode: receipt.mode,
      note: receipt.remarks ?? "",
      increaseAmount: 0,
      decreaseAmount: round2(Number(receipt.amountReceived) + Number(receipt.tdsAmount ?? 0)),
      sortValue: `${dateOnly(receipt.date)}|receipt|${receipt.reference ?? ""}|${receipt.id}`,
    })),
  ];

  entries.sort(compareEntries);

  return {
    entries,
    title: "Client Ledger",
    note:
      "Running balance reflects the receivable control total for the current scope. Invoices increase receivable balance. Receipts reduce it using gross settlement (cash + TDS).",
    partyLabel: "Client",
    increaseLabel: "Invoices",
    decreaseLabel: "Receipts",
    balanceLabel: "Receivable balance",
    filenameBase: `client-ledger-${periodLabel(undefined, to)}`,
  };
}

async function buildVendorLedgerEntries({
  tenantId,
  projectId,
  to,
}: {
  tenantId: number;
  projectId?: string;
  to?: string;
}) {
  const bills = await prisma.purchaseInvoice.findMany({
    where: {
      tenantId,
      ...(projectId ? { projectId } : {}),
      ...(to ? { invoiceDate: { lte: endOfDayUtc(to) } } : {}),
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

  const payments = await prisma.transaction.findMany({
    where: {
      tenantId,
      type: "EXPENSE",
      vendorId: { not: null },
      ...(projectId ? { projectId } : {}),
      ...(to ? { date: { lte: endOfDayUtc(to) } } : {}),
    },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      date: true,
      amount: true,
      tdsAmount: true,
      mode: true,
      reference: true,
      note: true,
      description: true,
      project: { select: { name: true } },
      vendor: { select: { name: true } },
    },
  });

  const allocations =
    payments.length === 0
      ? []
      : await prisma.transactionAllocation.findMany({
          where: {
            tenantId,
            transactionId: { in: payments.map((payment) => payment.id) },
            documentType: "PURCHASE_INVOICE",
          },
          select: {
            transactionId: true,
            documentId: true,
          },
        });

  const billNumbers =
    allocations.length === 0
      ? []
      : await prisma.purchaseInvoice.findMany({
          where: { tenantId, id: { in: [...new Set(allocations.map((allocation) => allocation.documentId))] } },
          select: { id: true, invoiceNumber: true },
        });

  const billNumberById = new Map(billNumbers.map((bill) => [bill.id, bill.invoiceNumber]));
  const billNumbersByPaymentId = new Map<string, string[]>();
  for (const allocation of allocations) {
    const invoiceNumber = billNumberById.get(allocation.documentId);
    if (!invoiceNumber) continue;
    billNumbersByPaymentId.set(allocation.transactionId, [
      ...(billNumbersByPaymentId.get(allocation.transactionId) ?? []),
      invoiceNumber,
    ]);
  }

  const entries: BaseLedgerEntry[] = [
    ...bills.map((bill) => ({
      id: bill.id,
      date: bill.invoiceDate,
      type: "BILL" as const,
      projectName: bill.project.name,
      partyName: bill.vendor.name,
      documentNumber: bill.invoiceNumber,
      reference: "",
      mode: "",
      note: "",
      increaseAmount: round2(Number(bill.total)),
      decreaseAmount: 0,
      sortValue: `${dateOnly(bill.invoiceDate)}|bill|${bill.invoiceNumber}|${bill.id}`,
    })),
    ...payments.map((payment) => {
      const linkedBills = [...new Set(billNumbersByPaymentId.get(payment.id) ?? [])];
      const documentNumber =
        linkedBills.length === 0
          ? ""
          : linkedBills.length <= 3
            ? linkedBills.join(", ")
            : `${linkedBills.slice(0, 3).join(", ")} +${linkedBills.length - 3} more`;

      return {
        id: payment.id,
        date: payment.date,
        type: "PAYMENT" as const,
        projectName: payment.project?.name ?? "",
        partyName: payment.vendor?.name ?? "",
        documentNumber,
        reference: payment.reference ?? "",
        mode: payment.mode ?? "",
        note: combinedText(payment.note, payment.description),
        increaseAmount: 0,
        decreaseAmount: round2(Number(payment.amount) + Number(payment.tdsAmount ?? 0)),
        sortValue: `${dateOnly(payment.date)}|payment|${payment.reference ?? ""}|${payment.id}`,
      };
    }),
  ];

  entries.sort(compareEntries);

  return {
    entries,
    title: "Vendor Ledger",
    note:
      "Running balance reflects the payable control total for the current scope. Bills increase payable balance. Payments made reduce it using gross payment (cash + TDS).",
    partyLabel: "Vendor",
    increaseLabel: "Bills",
    decreaseLabel: "Payments",
    balanceLabel: "Payable balance",
    filenameBase: `vendor-ledger-${periodLabel(undefined, to)}`,
  };
}

export async function buildLedgerReport({
  tenantId,
  projectId,
  kind,
  from,
  to,
}: {
  tenantId: number;
  projectId?: string;
  kind: LedgerKind;
  from?: string;
  to?: string;
}): Promise<LedgerReport> {
  const reportBase =
    kind === "client"
      ? await buildClientLedgerEntries({ tenantId, projectId, to })
      : await buildVendorLedgerEntries({ tenantId, projectId, to });

  let openingBalance = 0;
  let runningBalance = 0;
  let totalIncrease = 0;
  let totalDecrease = 0;
  const rows: LedgerRow[] = [];

  for (const entry of reportBase.entries) {
    const delta = entry.increaseAmount - entry.decreaseAmount;

    if (beforeRange(entry.date, from)) {
      openingBalance = round2(openingBalance + delta);
      continue;
    }

    if (!withinRange(entry.date, from, to)) continue;

    totalIncrease = round2(totalIncrease + entry.increaseAmount);
    totalDecrease = round2(totalDecrease + entry.decreaseAmount);
    runningBalance = round2((rows.length === 0 ? openingBalance : runningBalance) + delta);

    rows.push({
      id: entry.id,
      date: dateOnly(entry.date),
      type: entry.type,
      projectName: entry.projectName,
      partyName: entry.partyName,
      documentNumber: entry.documentNumber,
      reference: entry.reference,
      mode: entry.mode,
      note: entry.note,
      increaseAmount: entry.increaseAmount,
      decreaseAmount: entry.decreaseAmount,
      runningBalance,
    });
  }

  const closingBalance = round2(rows.at(-1)?.runningBalance ?? openingBalance);
  const fromValue = from?.trim() ?? "";
  const toValue = to?.trim() ?? "";
  const period = periodLabel(fromValue || undefined, toValue || undefined);

  const report: Omit<LedgerReport, "dataset"> = {
    kind,
    title: reportBase.title,
    from: fromValue,
    to: toValue,
    note: reportBase.note,
    partyLabel: reportBase.partyLabel,
    increaseLabel: reportBase.increaseLabel,
    decreaseLabel: reportBase.decreaseLabel,
    balanceLabel: reportBase.balanceLabel,
    openingBalance,
    totalIncrease,
    totalDecrease,
    closingBalance,
    rows,
  };

  return {
    ...report,
    dataset: {
      title: reportBase.title,
      filenameBase: `${kind}-ledger-${period}`,
      metaLines: [
        `Period: ${fromValue || "Start"} to ${toValue || "Today"}`,
        reportBase.note,
      ],
      columns: [
        { key: "date", label: "Date", width: 12 },
        { key: "typeLabel", label: "Type", width: 16 },
        { key: "projectName", label: "Project", width: 22 },
        { key: "partyName", label: reportBase.partyLabel, width: 22 },
        { key: "documentNumber", label: "Document", width: 20 },
        { key: "reference", label: "Reference", width: 18 },
        { key: "mode", label: "Mode", width: 14 },
        { key: "note", label: "Note", width: 28 },
        { key: "increaseAmount", label: reportBase.increaseLabel, width: 14, align: "right" },
        { key: "decreaseAmount", label: reportBase.decreaseLabel, width: 14, align: "right" },
        { key: "runningBalance", label: reportBase.balanceLabel, width: 16, align: "right" },
      ],
      rows: buildExportRows(report),
    },
  };
}
