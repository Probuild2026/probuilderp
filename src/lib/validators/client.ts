import { z } from "zod";

export const clientCreateSchema = z.object({
  name: z.string().min(1),
  contactPerson: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  billingAddress: z.string().optional(),
  gstin: z.string().optional(),
  pan: z.string().optional(),
});

export type ClientCreateInput = z.input<typeof clientCreateSchema>;

