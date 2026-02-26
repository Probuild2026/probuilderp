import { z } from "zod";

export const paymentStageUpsertSchema = z.object({
  id: z.string().optional(),
  projectId: z.string().min(1),
  stageName: z.string().min(1).max(200),
  scopeOfWork: z.string().optional(),
  percent: z.coerce.number().nonnegative().optional(),
  expectedAmount: z.coerce.number().nonnegative(),
  expectedBank: z.coerce.number().nonnegative().optional(),
  expectedCash: z.coerce.number().nonnegative().optional(),
  actualBank: z.coerce.number().nonnegative().optional(),
  actualCash: z.coerce.number().nonnegative().optional(),
  expectedDate: z.string().optional(),
  actualDate: z.string().optional(),
  notes: z.string().optional(),
  sortOrder: z.coerce.number().int().optional(),
});

export const paymentScheduleImportSchema = z.object({
  projectId: z.string().min(1),
});

