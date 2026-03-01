function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export type GstType = "INTRA" | "INTER" | "NOGST";

export function computeGstComponents(input: {
  taxableValue: number;
  gstRate: number; // percent, e.g. 18 for 18%
  gstType: GstType;
}) {
  const taxableValue = input.taxableValue;
  const gstRate = input.gstRate;
  const gstType = input.gstType;

  if (gstType === "NOGST" || gstRate === 0) {
    return { cgst: 0, sgst: 0, igst: 0, total: round2(taxableValue) };
  }

  const rate = gstRate / 100;

  if (gstType === "INTRA") {
    const half = taxableValue * (rate / 2);
    const cgst = round2(half);
    const sgst = round2(half);
    const igst = 0;
    const total = round2(taxableValue + cgst + sgst);
    return { cgst, sgst, igst, total };
  }

  const igst = round2(taxableValue * rate);
  const total = round2(taxableValue + igst);
  return { cgst: 0, sgst: 0, igst, total };
}

