import { z } from "zod";

export const stockDirectionSchema = z.enum(["IN", "OUT"]);

export const stockMovementCreateSchema = z.object({
  projectId: z.string().min(1),
  itemId: z.string().min(1),
  date: z.string().min(1),
  direction: stockDirectionSchema,
  quantity: z.coerce.number().positive(),
  unitCost: z.coerce.number().nonnegative().optional(),
  remarks: z.string().optional(),
});

export type StockMovementCreateInput = z.input<typeof stockMovementCreateSchema>;

