import { z } from "zod";

const optionalText = z.preprocess((value) => (value === "" ? undefined : value), z.string().trim().optional());
const optionalId = z.preprocess((value) => (value === "" ? undefined : value), z.string().min(1).optional());
const optionalMoney = z.preprocess((value) => (value === "" || value == null ? undefined : value), z.coerce.number().nonnegative().optional());

export const materialOrderCreateSchema = z.object({
  projectId: z.string().min(1, "Project is required"),
  vendorId: z.string().min(1, "Vendor is required"),
  itemId: z.string().min(1, "Material is required"),
  orderDate: z.string().min(1, "Order date is required"),
  expectedDeliveryDate: optionalText,
  quantityOrdered: z.coerce.number().positive("Quantity must be greater than zero"),
  rate: optionalMoney,
  stageName: optionalText,
  reference: optionalText,
  remarks: optionalText,
});

export const materialReceiptCreateSchema = z.object({
  projectId: z.string().min(1, "Project is required"),
  vendorId: z.string().min(1, "Vendor is required"),
  itemId: z.string().min(1, "Material is required"),
  materialOrderId: optionalId,
  purchaseInvoiceId: optionalId,
  receiptDate: z.string().min(1, "Delivery date is required"),
  challanNumber: optionalText,
  quantity: z.coerce.number().positive("Quantity must be greater than zero"),
  unitCost: optionalMoney,
  stageName: optionalText,
  vehicleNumber: optionalText,
  remarks: optionalText,
});

export const materialReceiptBillLinkSchema = z.object({
  receiptId: z.string().min(1),
  purchaseInvoiceId: z.string().min(1, "Bill is required"),
});

export const materialOrderUpdateSchema = materialOrderCreateSchema.extend({
  id: z.string().min(1),
});

export const materialReceiptUpdateSchema = materialReceiptCreateSchema.extend({
  id: z.string().min(1),
});

export const materialRecordDeleteSchema = z.object({
  id: z.string().min(1),
});

export type MaterialOrderCreateInput = z.input<typeof materialOrderCreateSchema>;
export type MaterialReceiptCreateInput = z.input<typeof materialReceiptCreateSchema>;
export type MaterialReceiptBillLinkInput = z.input<typeof materialReceiptBillLinkSchema>;
export type MaterialOrderUpdateInput = z.input<typeof materialOrderUpdateSchema>;
export type MaterialReceiptUpdateInput = z.input<typeof materialReceiptUpdateSchema>;
