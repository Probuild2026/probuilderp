import { Prisma, type VendorLegalType } from "@prisma/client";

export type ThresholdBreached = "NONE" | "SINGLE" | "AGGREGATE" | "BOTH";

export type Tds194cVendor = {
  legalType: VendorLegalType;
  pan: string | null;
  isTransporter: boolean;
  transporterVehicleCount: number | null;
  tdsOverrideRate: Prisma.Decimal | null;
  tdsThresholdSingle: Prisma.Decimal;
  tdsThresholdAnnual: Prisma.Decimal;
};

export type TdsResult = {
  applicable: boolean;
  ratePct: number;
  tdsAmount: Prisma.Decimal;
  thresholdBreached: ThresholdBreached;
  reason: string;
};

function thresholdFlag(singleExceeds: boolean, annualExceeds: boolean): ThresholdBreached {
  if (singleExceeds && annualExceeds) return "BOTH";
  if (singleExceeds) return "SINGLE";
  if (annualExceeds) return "AGGREGATE";
  return "NONE";
}

export function determineTDS194CRatePct(input: {
  vendor: Tds194cVendor;
  hasTransporterDeclaration: boolean;
}): number {
  const { vendor, hasTransporterDeclaration } = input;

  if (vendor.tdsOverrideRate != null) return vendor.tdsOverrideRate.toNumber();

  if (
    vendor.isTransporter &&
    hasTransporterDeclaration &&
    vendor.transporterVehicleCount != null &&
    vendor.transporterVehicleCount <= 10
  ) {
    return 0;
  }

  if (!vendor.pan) return 20; // 206AA

  if (vendor.legalType === "INDIVIDUAL" || vendor.legalType === "HUF") return 1;

  return 2;
}

export function calculateTDS194C(input: {
  vendor: Tds194cVendor;
  currentAmount: Prisma.Decimal; // taxable base for THIS payment
  ytdAmount: Prisma.Decimal; // taxable base already paid/credited in FY
  hasTransporterDeclaration: boolean;
}): TdsResult {
  const { vendor, currentAmount, ytdAmount, hasTransporterDeclaration } = input;

  const afterThis = ytdAmount.add(currentAmount);
  const singleExceeds = currentAmount.gt(vendor.tdsThresholdSingle);
  const annualExceeds = afterThis.gt(vendor.tdsThresholdAnnual);
  const breached = thresholdFlag(singleExceeds, annualExceeds);

  const ratePct = determineTDS194CRatePct({ vendor, hasTransporterDeclaration });

  const applicable = ratePct > 0 && (singleExceeds || annualExceeds);
  const tdsAmount = applicable
    ? currentAmount.mul(ratePct).div(100).toDecimalPlaces(2)
    : new Prisma.Decimal(0);

  let reason = "";
  if (!applicable) {
    reason = "Below thresholds or exempt.";
  } else if (ratePct === 20 && !vendor.pan) {
    reason = "TDS 20% under 206AA (PAN not provided).";
  } else if (
    vendor.isTransporter &&
    hasTransporterDeclaration &&
    vendor.transporterVehicleCount != null &&
    vendor.transporterVehicleCount <= 10
  ) {
    reason = "TDS 0% (transporter exemption).";
  } else {
    reason = `TDS ${ratePct}% under 194C (thresholds crossed: ${breached}).`;
  }

  return { applicable, ratePct, tdsAmount, thresholdBreached: breached, reason };
}
