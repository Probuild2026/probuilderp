import { getFinancialYear } from "@/lib/partner-finance";
import { type TabularDataset } from "@/lib/tabular-export";
import { prisma } from "@/server/db";

export type TdsSection = "194C" | "194T";

export type TdsSectionSummary = {
  section: TdsSection;
  deducted: number;
  paid: number;
  pending: number;
};

export type TdsVendorRow = {
  vendorId: string;
  vendorName: string;
  grossPaid: number;
  taxableBase: number;
  tdsDeducted: number;
  tdsPaid: number;
  tdsPending: number;
  note: string;
};

export type TdsPartnerRow = {
  partnerId: string;
  partnerName: string;
  grossAmount: number;
  tdsDeducted: number;
  tdsPaid: number;
  tdsPending: number;
  note: string;
};

export type VendorTdsPaymentRecord = {
  id: string;
  vendorId: string;
  vendorName: string;
  challanNo: string;
  periodFrom: string;
  periodTo: string;
  paymentDate: string;
  tdsPaidAmount: number;
  note: string;
};

export type TdsDashboardReport = {
  fy: string;
  title: string;
  note?: string;
  totalDeducted: number;
  totalPaid: number;
  totalPending: number;
  sections: TdsSectionSummary[];
  vendorRows: TdsVendorRow[];
  partnerRows: TdsPartnerRow[];
  vendorTdsPayments: VendorTdsPaymentRecord[];
  dataset: TabularDataset;
};

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function round2(value: number) {
  return Number(value.toFixed(2));
}

function normalizeFy(input?: string) {
  const value = (input ?? "").trim();
  return /^\d{4}-\d{2}$/.test(value) ? value : getFinancialYear(new Date());
}

function financialYearBounds(fy: string) {
  const startYear = Number(fy.slice(0, 4));
  if (!Number.isFinite(startYear)) throw new Error("Invalid FY");

  const start = new Date(Date.UTC(startYear, 3, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(startYear + 1, 3, 1, 0, 0, 0, 0) - 1);
  return { start, end };
}

export async function buildTdsDashboardReport({
  tenantId,
  fy,
}: {
  tenantId: number;
  fy?: string;
}): Promise<TdsDashboardReport> {
  const fyValue = normalizeFy(fy);
  const { start, end } = financialYearBounds(fyValue);

  const [vendorPayments, vendorTdsPayments, partnerRemunerations, partnerTdsPayments] = await Promise.all([
    prisma.transaction.findMany({
      where: {
        tenantId,
        type: "EXPENSE",
        vendorId: { not: null },
        date: { gte: start, lte: end },
      },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      select: {
        vendorId: true,
        amount: true,
        tdsAmount: true,
        tdsBaseAmount: true,
        vendor: { select: { name: true } },
      },
    }),
    prisma.vendorTdsPayment.findMany({
      where: { tenantId, fy: fyValue },
      orderBy: [{ paymentDate: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        vendorId: true,
        challanNo: true,
        periodFrom: true,
        periodTo: true,
        paymentDate: true,
        tdsPaidAmount: true,
        note: true,
        vendor: { select: { name: true } },
      },
    }),
    prisma.partnerRemuneration.findMany({
      where: { tenantId, fy: fyValue },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      select: {
        partnerId: true,
        grossAmount: true,
        tdsAmount: true,
        partner: { select: { name: true } },
      },
    }),
    prisma.partnerTdsPayment.findMany({
      where: { tenantId, fy: fyValue },
      orderBy: [{ paymentDate: "asc" }, { createdAt: "asc" }],
      select: {
        partnerId: true,
        tdsPaidAmount: true,
        partner: { select: { name: true } },
      },
    }),
  ]);

  const vendors = new Map<string, TdsVendorRow>();
  for (const payment of vendorPayments) {
    const vendorId = payment.vendorId;
    if (!vendorId) continue;

    const row = vendors.get(vendorId) ?? {
      vendorId,
      vendorName: payment.vendor?.name ?? "Unknown vendor",
      grossPaid: 0,
      taxableBase: 0,
      tdsDeducted: 0,
      tdsPaid: 0,
      tdsPending: 0,
      note: "",
    };

    row.grossPaid = round2(row.grossPaid + Number(payment.amount) + Number(payment.tdsAmount ?? 0));
    row.taxableBase = round2(row.taxableBase + Number(payment.tdsBaseAmount ?? 0));
    row.tdsDeducted = round2(row.tdsDeducted + Number(payment.tdsAmount ?? 0));
    vendors.set(vendorId, row);
  }

  const vendorPaidById = new Map<string, number>();
  const vendorTdsPaymentRecords = vendorTdsPayments.map((payment) => ({
    id: payment.id,
    vendorId: payment.vendorId,
    vendorName: payment.vendor.name,
    challanNo: payment.challanNo ?? "",
    periodFrom: payment.periodFrom ? dateOnly(payment.periodFrom) : "",
    periodTo: payment.periodTo ? dateOnly(payment.periodTo) : "",
    paymentDate: dateOnly(payment.paymentDate),
    tdsPaidAmount: round2(Number(payment.tdsPaidAmount)),
    note: payment.note ?? "",
  }));

  for (const payment of vendorTdsPayments) {
    vendorPaidById.set(
      payment.vendorId,
      round2((vendorPaidById.get(payment.vendorId) ?? 0) + Number(payment.tdsPaidAmount)),
    );

    if (vendors.has(payment.vendorId)) continue;
    vendors.set(payment.vendorId, {
      vendorId: payment.vendorId,
      vendorName: payment.vendor.name,
      grossPaid: 0,
      taxableBase: 0,
      tdsDeducted: 0,
      tdsPaid: 0,
      tdsPending: 0,
      note: "",
    });
  }

  const vendorRows = [...vendors.values()]
    .map((row) => {
      const tdsPaid = vendorPaidById.get(row.vendorId) ?? 0;
      const tdsPending = Math.max(0, round2(row.tdsDeducted - tdsPaid));

      let note = "No TDS deducted.";
      if (row.tdsDeducted <= 0 && tdsPaid > 0) note = "TDS payment recorded without deducted vendor payments in this FY.";
      else if (tdsPaid > row.tdsDeducted && row.tdsDeducted > 0) note = "Recorded TDS payment exceeds deducted amount for this FY.";
      else if (row.tdsDeducted > 0 && tdsPaid <= 0) note = "TDS deducted but not remitted yet.";
      else if (row.tdsDeducted > 0 && tdsPending > 0) note = "TDS deducted and partly remitted.";
      else if (row.tdsDeducted > 0) note = "TDS deducted and remitted.";

      return {
        ...row,
        tdsPaid,
        tdsPending,
        note,
      };
    })
    .sort((left, right) => left.vendorName.localeCompare(right.vendorName));

  const partnerPaidById = new Map<string, number>();
  for (const payment of partnerTdsPayments) {
    partnerPaidById.set(
      payment.partnerId,
      round2((partnerPaidById.get(payment.partnerId) ?? 0) + Number(payment.tdsPaidAmount)),
    );
  }

  const partners = new Map<string, TdsPartnerRow>();
  for (const payment of partnerTdsPayments) {
    if (partners.has(payment.partnerId)) continue;
    partners.set(payment.partnerId, {
      partnerId: payment.partnerId,
      partnerName: payment.partner.name,
      grossAmount: 0,
      tdsDeducted: 0,
      tdsPaid: partnerPaidById.get(payment.partnerId) ?? 0,
      tdsPending: 0,
      note: "",
    });
  }
  for (const remuneration of partnerRemunerations) {
    const row = partners.get(remuneration.partnerId) ?? {
      partnerId: remuneration.partnerId,
      partnerName: remuneration.partner.name,
      grossAmount: 0,
      tdsDeducted: 0,
      tdsPaid: partnerPaidById.get(remuneration.partnerId) ?? 0,
      tdsPending: 0,
      note: "",
    };

    row.grossAmount = round2(row.grossAmount + Number(remuneration.grossAmount));
    row.tdsDeducted = round2(row.tdsDeducted + Number(remuneration.tdsAmount));
    partners.set(remuneration.partnerId, row);
  }

  const partnerRows = [...partners.values()]
    .map((row) => {
      const pending = Math.max(0, round2(row.tdsDeducted - row.tdsPaid));
        return {
        ...row,
        tdsPending: pending,
        note:
          row.tdsDeducted <= 0 && row.tdsPaid > 0
            ? "TDS payment recorded without remuneration rows in this FY."
            : row.tdsDeducted <= 0
            ? "Below threshold / not applicable."
            : pending > 0
              ? "TDS deducted but not fully paid."
              : "TDS deducted and paid.",
      };
    })
    .sort((left, right) => left.partnerName.localeCompare(right.partnerName));

  const section194C: TdsSectionSummary = {
    section: "194C",
    deducted: round2(vendorRows.reduce((acc, row) => acc + row.tdsDeducted, 0)),
    paid: round2(vendorRows.reduce((acc, row) => acc + row.tdsPaid, 0)),
    pending: round2(vendorRows.reduce((acc, row) => acc + row.tdsPending, 0)),
  };

  const section194T: TdsSectionSummary = {
    section: "194T",
    deducted: round2(partnerRows.reduce((acc, row) => acc + row.tdsDeducted, 0)),
    paid: round2(partnerRows.reduce((acc, row) => acc + row.tdsPaid, 0)),
    pending: round2(partnerRows.reduce((acc, row) => acc + row.tdsPending, 0)),
  };

  const sections = [section194C, section194T];
  const totalDeducted = round2(sections.reduce((acc, row) => acc + row.deducted, 0));
  const totalPaid = round2(sections.reduce((acc, row) => acc + row.paid, 0));
  const totalPending = round2(sections.reduce((acc, row) => acc + row.pending, 0));

  return {
    fy: fyValue,
    title: "TDS Dashboard",
    note: "This is a tenant-level FY view. Use Section 194C rows for vendor/subcontractor TDS and Section 194T rows for partner remuneration TDS. Record each 194C challan/remittance against the relevant vendor so paid and pending numbers stay accurate.",
    totalDeducted,
    totalPaid,
    totalPending,
    sections,
    vendorRows,
    partnerRows,
    vendorTdsPayments: vendorTdsPaymentRecords,
    dataset: {
      title: "TDS Dashboard",
      filenameBase: `tds-dashboard-${fyValue}`,
      metaLines: [
        `Financial year: ${fyValue}`,
        "194C paid amounts come from recorded vendor TDS remittance rows.",
      ],
      columns: [
        { key: "section", label: "Section", width: 10 },
        { key: "partyName", label: "Party", width: 24 },
        { key: "grossAmount", label: "Gross", width: 14, align: "right" },
        { key: "taxableBase", label: "Taxable Base", width: 14, align: "right" },
        { key: "tdsDeducted", label: "Deducted", width: 14, align: "right" },
        { key: "tdsPaid", label: "Paid", width: 14, align: "right" },
        { key: "tdsPending", label: "Pending", width: 14, align: "right" },
        { key: "note", label: "Note", width: 30 },
      ],
      rows: [
        ...vendorRows.map((row) => ({
          section: "194C",
          partyName: row.vendorName,
          grossAmount: row.grossPaid,
          taxableBase: row.taxableBase,
          tdsDeducted: row.tdsDeducted,
          tdsPaid: row.tdsPaid,
          tdsPending: row.tdsPending,
          note: row.note,
        })),
        ...partnerRows.map((row) => ({
          section: "194T",
          partyName: row.partnerName,
          grossAmount: row.grossAmount,
          taxableBase: "",
          tdsDeducted: row.tdsDeducted,
          tdsPaid: row.tdsPaid,
          tdsPending: row.tdsPending,
          note: row.note,
        })),
      ],
    },
  };
}
