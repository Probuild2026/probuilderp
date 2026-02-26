import { z } from "zod";

export const expenseCreateSchema = z.object({
  projectId: z.string().min(1),
  expenseType: z.enum(["MATERIAL", "LABOUR", "SUBCONTRACTOR", "OVERHEAD"]),
  vendorId: z.string().optional(),
  labourerId: z.string().optional(),
  date: z.string().min(1),
  amountBeforeTax: z.coerce.number().nonnegative(),
  cgst: z.coerce.number().nonnegative().optional(),
  sgst: z.coerce.number().nonnegative().optional(),
  igst: z.coerce.number().nonnegative().optional(),
  paymentMode: z.enum(["CASH", "BANK_TRANSFER", "CHEQUE", "UPI", "CARD", "OTHER"]).optional(),
  narration: z.string().optional(),
});

export type ExpenseCreateInput = z.input<typeof expenseCreateSchema>;

