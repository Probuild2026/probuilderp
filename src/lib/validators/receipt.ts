import { z } from "zod";

export const receiptCreateSchema = z.object({
  clientInvoiceId: z.string().min(1),
  date: z.string().min(1),
  amountReceived: z.coerce.number().positive(),
  mode: z.enum(["CASH", "BANK_TRANSFER", "CHEQUE", "UPI", "CARD", "OTHER"]),
  reference: z.string().optional(),
  tdsDeducted: z.coerce.boolean().optional(),
  tdsAmount: z.coerce.number().nonnegative().optional(),
  remarks: z.string().optional(),
});

