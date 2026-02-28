import { z } from "zod";

const optionalTrimmed = z
  .string()
  .optional()
  .transform((v) => {
    const t = v?.trim();
    return t ? t : undefined;
  });

const optionalEmail = optionalTrimmed.refine((v) => !v || z.string().email().safeParse(v).success, {
  message: "Invalid email",
});

const optionalNumber = (schema: z.ZodNumber) =>
  z.union([z.coerce.number(), z.literal("")]).transform((v) => (v === "" ? undefined : v)).pipe(schema.optional());

const numberWithDefault = (schema: z.ZodNumber, defaultValue: number) =>
  z.union([z.coerce.number(), z.literal("")]).transform((v) => (v === "" ? defaultValue : v)).pipe(schema);

export const vendorCreateSchema = z.object({
  name: z.string().min(1),
  trade: optionalTrimmed,
  gstin: optionalTrimmed,
  pan: optionalTrimmed,
  phone: optionalTrimmed,
  email: optionalEmail,
  address: optionalTrimmed,
  isSubcontractor: z.boolean().default(false),
  legalType: z.enum(["INDIVIDUAL", "HUF", "FIRM", "COMPANY", "OTHER"]).default("OTHER"),
  active: z.boolean().default(true),

  // TDS (defaults per 194C)
  tdsSection: z.string().min(1).max(20).default("194C"),
  tdsOverrideRate: optionalNumber(z.number().min(0).max(100)),
  tdsThresholdSingle: numberWithDefault(z.number().min(0), 30000),
  tdsThresholdAnnual: numberWithDefault(z.number().min(0), 100000),

  // Transporter exemption (if applicable)
  isTransporter: z.boolean().default(false),
  transporterVehicleCount: optionalNumber(z.number().int().min(0)),
});

export type VendorCreateInput = z.infer<typeof vendorCreateSchema>;
