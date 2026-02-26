import { z } from "zod";

export const projectStatusSchema = z.enum([
  "PLANNED",
  "ACTIVE",
  "ON_HOLD",
  "COMPLETED",
  "CANCELLED",
]);

export const projectUpsertSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  clientId: z.string().min(1),
  location: z.string().optional(),
  status: projectStatusSchema.default("ACTIVE"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  remarks: z.string().optional(),
});

export type ProjectUpsertInput = z.input<typeof projectUpsertSchema>;

