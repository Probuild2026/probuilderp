import { Prisma } from "@prisma/client";

export const PARTNER_TDS_SECTION = "194T";
export const PARTNER_TDS_THRESHOLD = 20_000;
export const PARTNER_DEFAULT_TDS_RATE = 10;

export function getFinancialYear(input: Date) {
  const year = input.getFullYear();
  const month = input.getMonth() + 1;
  if (month >= 4) return `${year}-${String((year + 1) % 100).padStart(2, "0")}`;
  return `${year - 1}-${String(year % 100).padStart(2, "0")}`;
}

export function parseDateOnly(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid date");
  return date;
}

export function toDecimal(value: number | string | Prisma.Decimal) {
  return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
}

export function computePartnerRemuneration({
  grossAmount,
  fyGrossBeforeCurrent,
  tdsRatePercent = PARTNER_DEFAULT_TDS_RATE,
}: {
  grossAmount: number | Prisma.Decimal;
  fyGrossBeforeCurrent: number | Prisma.Decimal;
  tdsRatePercent?: number;
}) {
  const gross = toDecimal(grossAmount);
  const aggregate = toDecimal(fyGrossBeforeCurrent).add(gross);
  const shouldDeduct = aggregate.gt(new Prisma.Decimal(PARTNER_TDS_THRESHOLD));
  const rate = new Prisma.Decimal(tdsRatePercent);
  const tdsAmount = shouldDeduct
    ? gross.mul(rate).div(new Prisma.Decimal(100))
    : new Prisma.Decimal(0);
  const netPayable = gross.sub(tdsAmount);

  return {
    shouldDeduct,
    tdsAmount,
    netPayable,
    tdsRate: rate,
  };
}
