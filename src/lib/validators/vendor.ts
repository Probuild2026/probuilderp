import { z } from "zod";

export const vendorCreateSchema = z.object({
  name: z.string().min(1),
  trade: z.string().optional(),
  gstin: z.string().optional(),
  pan: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
  isSubcontractor: z.boolean().default(false),
});

export type VendorCreateInput = z.input<typeof vendorCreateSchema>;
