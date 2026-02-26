import { z } from "zod";

export const clientInvoiceCreateSchema = z.object({
  projectId: z.string().min(1),
  clientId: z.string().min(1),
  invoiceNumber: z.string().min(1).max(50),
  invoiceDate: z.string().min(1),
  dueDate: z.string().optional(),
  serviceDescription: z.string().optional(),
  sacCode: z.string().optional(),
  gstType: z.enum(["INTRA", "INTER"]),
  gstRate: z.coerce.number().min(0).max(100).optional(),
  basicValue: z.coerce.number().nonnegative(),
  cgst: z.coerce.number().nonnegative().optional(),
  sgst: z.coerce.number().nonnegative().optional(),
  igst: z.coerce.number().nonnegative().optional(),
  total: z.coerce.number().nonnegative(),
  tdsRate: z.coerce.number().min(0).max(100).optional(),
  tdsAmountExpected: z.coerce.number().nonnegative().optional(),
  status: z.string().min(1).max(30).default("DUE"),
});

export const clientInvoiceUpdateSchema = clientInvoiceCreateSchema.extend({
  id: z.string().min(1),
});

