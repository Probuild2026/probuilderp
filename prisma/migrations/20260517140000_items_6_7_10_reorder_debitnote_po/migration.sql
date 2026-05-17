-- Item 10: Add reorder level to Item for low-stock alerts.
ALTER TABLE "Item"
ADD COLUMN "reorderLevel" DECIMAL(14, 3);

-- Item 7: Debit Note model — records vendor overbilling or material returns against a bill.
CREATE TABLE "DebitNote" (
  "id"                TEXT NOT NULL,
  "tenantId"          INTEGER NOT NULL DEFAULT 1,
  "purchaseInvoiceId" TEXT NOT NULL,
  "debitNoteNumber"   TEXT NOT NULL,
  "date"              DATE NOT NULL,
  "reason"            TEXT NOT NULL,
  "taxableValue"      DECIMAL(14, 2) NOT NULL,
  "cgst"              DECIMAL(14, 2) NOT NULL DEFAULT 0,
  "sgst"              DECIMAL(14, 2) NOT NULL DEFAULT 0,
  "igst"              DECIMAL(14, 2) NOT NULL DEFAULT 0,
  "total"             DECIMAL(14, 2) NOT NULL,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DebitNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DebitNote_tenantId_idx" ON "DebitNote"("tenantId");
CREATE INDEX "DebitNote_tenantId_purchaseInvoiceId_idx" ON "DebitNote"("tenantId", "purchaseInvoiceId");
CREATE INDEX "DebitNote_tenantId_date_idx" ON "DebitNote"("tenantId", "date");

ALTER TABLE "DebitNote" ADD CONSTRAINT "DebitNote_purchaseInvoiceId_fkey"
  FOREIGN KEY ("purchaseInvoiceId") REFERENCES "PurchaseInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DebitNote" ADD CONSTRAINT "DebitNote_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Item 6: Link bills to purchase orders (optional, set null on PO delete).
ALTER TABLE "PurchaseInvoice"
ADD COLUMN "purchaseOrderId" TEXT;

CREATE INDEX "PurchaseInvoice_tenantId_purchaseOrderId_idx" ON "PurchaseInvoice"("tenantId", "purchaseOrderId");

-- Item 6: Purchase Order status enum.
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'SENT', 'PARTIALLY_BILLED', 'FULLY_BILLED', 'CANCELLED');

-- Item 6: Purchase Order header.
CREATE TABLE "PurchaseOrder" (
  "id"          TEXT NOT NULL,
  "tenantId"    INTEGER NOT NULL DEFAULT 1,
  "vendorId"    TEXT NOT NULL,
  "projectId"   TEXT NOT NULL,
  "orderNumber" TEXT NOT NULL,
  "orderDate"   DATE NOT NULL,
  "status"      "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
  "notes"       TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PurchaseOrder_tenantId_orderNumber_key" ON "PurchaseOrder"("tenantId", "orderNumber");
CREATE INDEX "PurchaseOrder_tenantId_idx" ON "PurchaseOrder"("tenantId");
CREATE INDEX "PurchaseOrder_tenantId_vendorId_orderDate_idx" ON "PurchaseOrder"("tenantId", "vendorId", "orderDate");
CREATE INDEX "PurchaseOrder_tenantId_projectId_orderDate_idx" ON "PurchaseOrder"("tenantId", "projectId", "orderDate");
CREATE INDEX "PurchaseOrder_tenantId_status_idx" ON "PurchaseOrder"("tenantId", "status");

ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_vendorId_fkey"
  FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PurchaseInvoice" ADD CONSTRAINT "PurchaseInvoice_purchaseOrderId_fkey"
  FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Item 6: Purchase Order line items.
CREATE TABLE "PurchaseOrderLine" (
  "id"              TEXT NOT NULL,
  "tenantId"        INTEGER NOT NULL DEFAULT 1,
  "purchaseOrderId" TEXT NOT NULL,
  "description"     TEXT NOT NULL,
  "unit"            TEXT,
  "quantity"        DECIMAL(14, 3) NOT NULL,
  "rate"            DECIMAL(14, 2) NOT NULL,
  "amount"          DECIMAL(14, 2) NOT NULL,
  "sortOrder"       INTEGER NOT NULL DEFAULT 0,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PurchaseOrderLine_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PurchaseOrderLine_tenantId_idx" ON "PurchaseOrderLine"("tenantId");
CREATE INDEX "PurchaseOrderLine_tenantId_purchaseOrderId_idx" ON "PurchaseOrderLine"("tenantId", "purchaseOrderId");

ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_purchaseOrderId_fkey"
  FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
