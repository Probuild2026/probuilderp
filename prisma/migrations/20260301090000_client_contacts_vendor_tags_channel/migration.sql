-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('BANK', 'CASH', 'ADJUSTMENT');

-- AlterEnum
ALTER TYPE "ItemType" ADD VALUE 'LABOUR';

-- AlterEnum
ALTER TYPE "GstType" ADD VALUE 'NOGST';

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "notes" TEXT,
ADD COLUMN     "paymentTermsDays" INTEGER,
ADD COLUMN     "preferredPaymentMode" TEXT,
ADD COLUMN     "siteAddress" TEXT;

-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "tdsApplicable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tdsRate" DECIMAL(5,2),
ADD COLUMN     "tdsThreshold" DECIMAL(14,2),
ADD COLUMN     "type" TEXT;

-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "category" TEXT,
ADD COLUMN     "defaultGstRate" DECIMAL(5,2),
ADD COLUMN     "description" TEXT,
ADD COLUMN     "trackInventory" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "channel" "Channel" NOT NULL DEFAULT 'BANK';

-- AlterTable
ALTER TABLE "PurchaseInvoice" ADD COLUMN     "gstRate" DECIMAL(5,2);

-- AlterTable
ALTER TABLE "Receipt" ADD COLUMN     "channel" "Channel" NOT NULL DEFAULT 'BANK';

-- CreateTable
CREATE TABLE "ClientContact" (
    "id" TEXT NOT NULL,
    "tenantId" INTEGER NOT NULL DEFAULT 1,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "phone" TEXT,
    "whatsapp" TEXT,
    "email" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemVendor" (
    "id" TEXT NOT NULL,
    "tenantId" INTEGER NOT NULL DEFAULT 1,
    "itemId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemVendor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClientContact_tenantId_idx" ON "ClientContact"("tenantId");

-- CreateIndex
CREATE INDEX "ClientContact_tenantId_clientId_idx" ON "ClientContact"("tenantId", "clientId");

-- CreateIndex
CREATE INDEX "ClientContact_tenantId_clientId_isPrimary_idx" ON "ClientContact"("tenantId", "clientId", "isPrimary");

-- CreateIndex
CREATE INDEX "ItemVendor_tenantId_idx" ON "ItemVendor"("tenantId");

-- CreateIndex
CREATE INDEX "ItemVendor_tenantId_itemId_idx" ON "ItemVendor"("tenantId", "itemId");

-- CreateIndex
CREATE INDEX "ItemVendor_tenantId_vendorId_idx" ON "ItemVendor"("tenantId", "vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemVendor_tenantId_itemId_vendorId_key" ON "ItemVendor"("tenantId", "itemId", "vendorId");

-- AddForeignKey
ALTER TABLE "ClientContact" ADD CONSTRAINT "ClientContact_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientContact" ADD CONSTRAINT "ClientContact_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemVendor" ADD CONSTRAINT "ItemVendor_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemVendor" ADD CONSTRAINT "ItemVendor_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemVendor" ADD CONSTRAINT "ItemVendor_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

