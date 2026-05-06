import { z } from "zod";

export const stockDirectionSchema = z.enum(["IN", "OUT"]);

export const stockMovementCreateSchema = z.object({
  projectId: z.string().min(1),
  itemId: z.string().min(1),
  date: z.string().min(1),
  direction: stockDirectionSchema,
  quantity: z.coerce.number().positive(),
  unitCost: z.coerce.number().nonnegative().optional(),
  stageName: z.string().optional(),
  remarks: z.string().optional(),
});

export const stockMovementUpdateSchema = stockMovementCreateSchema.extend({
  id: z.string().min(1),
});

export const stockMovementDeleteSchema = z.object({
  id: z.string().min(1),
});

export type StockMovementCreateInput = z.input<typeof stockMovementCreateSchema>;
export type StockMovementUpdateInput = z.input<typeof stockMovementUpdateSchema>;
