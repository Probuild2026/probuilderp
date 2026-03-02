import { z } from "zod";

export const paymentStageUpsertSchema = z.object({
  id: z.string().optional(),
  projectId: z.string().min(1),
  stageName: z.string().min(1).max(200),
  scopeOfWork: z.string().optional(),
  percent: z.coerce.number().nonnegative().optional(),
  // Contract split (Bank + Cash). Stage total is derived from these.
  expectedBank: z.coerce.number().nonnegative(),
  expectedCash: z.coerce.number().nonnegative(),
  // Backward-compat: older UI may still send expectedAmount; we ignore and derive.
  expectedAmount: z.coerce.number().nonnegative().optional(),
  expectedDate: z.string().optional(),
  actualDate: z.string().optional(),
  notes: z.string().optional(),
  sortOrder: z.coerce.number().int().optional(),
});

export const paymentScheduleImportSchema = z.object({
  projectId: z.string().min(1),
});
