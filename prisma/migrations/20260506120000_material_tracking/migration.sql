-- Material order and receipt tracking for project inventory.

CREATE TYPE "MaterialOrderStatus" AS ENUM ('ORDERED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'CANCELLED');

ALTER TYPE "StockReferenceType" ADD VALUE 'MATERIAL_RECEIPT';

ALTER TABLE "StockMovement" ADD COLUMN "stageName" TEXT;

CREATE TABLE "MaterialOrder" (
    "id" TEXT NOT NULL,
    "tenantId" INTEGER NOT NULL DEFAULT 1,
    "projectId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "orderDate" DATE NOT NULL,
    "expectedDeliveryDate" DATE,
    "quantityOrdered" DECIMAL(14,3) NOT NULL,
    "rate" DECIMAL(14,2),
    "amount" DECIMAL(14,2),
    "status" "MaterialOrderStatus" NOT NULL DEFAULT 'ORDERED',
    "stageName" TEXT,
    "reference" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MaterialReceipt" (
    "id" TEXT NOT NULL,
    "tenantId" INTEGER NOT NULL DEFAULT 1,
    "projectId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "materialOrderId" TEXT,
    "purchaseInvoiceId" TEXT,
    "stockMovementId" TEXT,
    "receiptDate" DATE NOT NULL,
    "challanNumber" TEXT,
    "quantity" DECIMAL(14,3) NOT NULL,
    "unitCost" DECIMAL(14,2),
    "amount" DECIMAL(14,2),
    "stageName" TEXT,
    "vehicleNumber" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialReceipt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MaterialReceipt_stockMovementId_key" ON "MaterialReceipt"("stockMovementId");

CREATE INDEX "MaterialOrder_tenantId_idx" ON "MaterialOrder"("tenantId");
CREATE INDEX "MaterialOrder_tenantId_projectId_orderDate_idx" ON "MaterialOrder"("tenantId", "projectId", "orderDate");
CREATE INDEX "MaterialOrder_tenantId_vendorId_orderDate_idx" ON "MaterialOrder"("tenantId", "vendorId", "orderDate");
CREATE INDEX "MaterialOrder_tenantId_itemId_orderDate_idx" ON "MaterialOrder"("tenantId", "itemId", "orderDate");
CREATE INDEX "MaterialOrder_tenantId_status_idx" ON "MaterialOrder"("tenantId", "status");

CREATE INDEX "MaterialReceipt_tenantId_idx" ON "MaterialReceipt"("tenantId");
CREATE INDEX "MaterialReceipt_tenantId_projectId_receiptDate_idx" ON "MaterialReceipt"("tenantId", "projectId", "receiptDate");
CREATE INDEX "MaterialReceipt_tenantId_vendorId_receiptDate_idx" ON "MaterialReceipt"("tenantId", "vendorId", "receiptDate");
CREATE INDEX "MaterialReceipt_tenantId_itemId_receiptDate_idx" ON "MaterialReceipt"("tenantId", "itemId", "receiptDate");
CREATE INDEX "MaterialReceipt_tenantId_materialOrderId_idx" ON "MaterialReceipt"("tenantId", "materialOrderId");
CREATE INDEX "MaterialReceipt_tenantId_purchaseInvoiceId_idx" ON "MaterialReceipt"("tenantId", "purchaseInvoiceId");

ALTER TABLE "MaterialOrder" ADD CONSTRAINT "MaterialOrder_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MaterialOrder" ADD CONSTRAINT "MaterialOrder_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MaterialOrder" ADD CONSTRAINT "MaterialOrder_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MaterialOrder" ADD CONSTRAINT "MaterialOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MaterialReceipt" ADD CONSTRAINT "MaterialReceipt_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MaterialReceipt" ADD CONSTRAINT "MaterialReceipt_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MaterialReceipt" ADD CONSTRAINT "MaterialReceipt_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MaterialReceipt" ADD CONSTRAINT "MaterialReceipt_materialOrderId_fkey" FOREIGN KEY ("materialOrderId") REFERENCES "MaterialOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MaterialReceipt" ADD CONSTRAINT "MaterialReceipt_purchaseInvoiceId_fkey" FOREIGN KEY ("purchaseInvoiceId") REFERENCES "PurchaseInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MaterialReceipt" ADD CONSTRAINT "MaterialReceipt_stockMovementId_fkey" FOREIGN KEY ("stockMovementId") REFERENCES "StockMovement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MaterialReceipt" ADD CONSTRAINT "MaterialReceipt_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
