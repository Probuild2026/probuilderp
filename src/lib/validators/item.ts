import { z } from "zod";

export const itemTypeSchema = z.enum(["MATERIAL", "SERVICE"]);

export const itemUpsertSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  type: itemTypeSchema.default("MATERIAL"),
  unit: z.string().optional(),
  sacHsnCode: z.string().optional(),
  gstRate: z.coerce.number().min(0).max(100),
});

export type ItemUpsertFormValues = z.input<typeof itemUpsertSchema>;
export type ItemUpsertData = z.infer<typeof itemUpsertSchema>;
