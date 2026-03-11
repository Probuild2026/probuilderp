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

const optionalIfsc = optionalTrimmed.refine((v) => !v || /^[A-Za-z]{4}0[A-Za-z0-9]{6}$/.test(v), {
  message: "Invalid IFSC code",
});

const optionalUpi = optionalTrimmed.refine((v) => !v || /^[A-Za-z0-9._-]{2,}@[A-Za-z]{2,}$/.test(v), {
  message: "Invalid UPI ID",
});

const optionalNumber = (schema: z.ZodNumber) =>
  z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : v),
    z.coerce.number().pipe(schema).optional()
  );

const numberWithDefault = (schema: z.ZodNumber, defaultValue: number) =>
  z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? defaultValue : v),
    z.coerce.number().pipe(schema)
  );

export const vendorCreateSchema = z.object({
  name: z.string().min(1),
  trade: optionalTrimmed,
  gstin: optionalTrimmed,
  pan: optionalTrimmed,
  phone: optionalTrimmed,
  email: optionalEmail,
  address: optionalTrimmed,
  beneficiaryName: optionalTrimmed,
  bankName: optionalTrimmed,
  bankBranch: optionalTrimmed,
  bankAccountNumber: optionalTrimmed,
  ifscCode: optionalIfsc,
  upiId: optionalUpi,
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

export const vendorUpdateSchema = vendorCreateSchema.extend({
  id: z.string().min(1),
});

export type VendorUpdateInput = z.infer<typeof vendorUpdateSchema>;

export const vendorMergeSchema = z.object({
  fromVendorId: z.string().min(1),
  toVendorId: z.string().min(1),
});

export type VendorMergeInput = z.infer<typeof vendorMergeSchema>;
