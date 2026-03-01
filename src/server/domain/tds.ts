export type TdsContext = {
  vendorHasPan: boolean;
  tdsApplicable: boolean;
  tdsRate: number; // decimal rate, e.g. 0.01 for 1%
  tdsThreshold: number; // yearly threshold in currency units
  grossPaidThisFy: number;
  currentGross: number;
};

export function computeTds(ctx: TdsContext) {
  const totalAfterPayment = ctx.grossPaidThisFy + ctx.currentGross;

  if (!ctx.tdsApplicable) return { tdsAmount: 0, shouldApply: false };
  if (!ctx.vendorHasPan) return { tdsAmount: 0, shouldApply: false };
  if (totalAfterPayment < ctx.tdsThreshold) return { tdsAmount: 0, shouldApply: false };

  const tdsAmount = ctx.currentGross * ctx.tdsRate;
  return { tdsAmount, shouldApply: true };
}

