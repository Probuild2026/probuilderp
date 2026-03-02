import { z } from "zod";

export const receiptCreateSchema = z.object({
  clientInvoiceId: z.string().min(1),
  date: z.string().min(1),
  amountReceived: z.coerce.number().positive(),
  mode: z.enum(["CASH", "BANK_TRANSFER", "CHEQUE", "UPI", "CARD", "OTHER"]),
  channel: z.enum(["BANK", "CASH"]).default("BANK"),
  projectPaymentStageId: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().min(1).optional(),
  ),
  reference: z.string().optional(),
  tdsDeducted: z.coerce.boolean().optional(),
  tdsAmount: z.coerce.number().nonnegative().optional(),
  remarks: z.string().optional(),
}).superRefine((data, ctx) => {
  // If it's a cash receipt, keep the payment mode consistent.
  if (data.channel === "CASH" && data.mode !== "CASH") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["mode"],
      message: "For cash receipts, set Mode to Cash.",
    });
  }
});

export const receiptUpdateSchema = receiptCreateSchema.extend({
  id: z.string().min(1),
});
