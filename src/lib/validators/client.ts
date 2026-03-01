import { z } from "zod";

export const clientCreateSchema = z.object({
  name: z.string().min(1),
  contactPerson: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  billingAddress: z.string().optional(),
  siteAddress: z.string().optional(),
  gstin: z.string().optional(),
  pan: z.string().optional(),
  paymentTermsDays: z.coerce.number().int().min(0).max(3650).optional(),
  preferredPaymentMode: z.string().optional(),
  notes: z.string().optional(),
});

export type ClientCreateInput = z.input<typeof clientCreateSchema>;

export const clientUpdateSchema = clientCreateSchema.extend({
  id: z.string().min(1),
});

export type ClientUpdateInput = z.input<typeof clientUpdateSchema>;
