-- CreateEnum
CREATE TYPE "VendorLegalType" AS ENUM ('INDIVIDUAL', 'HUF', 'FIRM', 'COMPANY', 'OTHER');

-- CreateEnum
CREATE TYPE "AttachmentEntityType" AS ENUM ('EXPENSE', 'PURCHASE_INVOICE', 'CLIENT_INVOICE', 'PAYMENT_VOUCHER', 'LABOUR_PAYMENT');

-- CreateEnum
CREATE TYPE "StockDirection" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "StockReferenceType" AS ENUM ('PURCHASE_INVOICE', 'EXPENSE', 'ADJUSTMENT', 'ISSUE', 'RETURN');

-- CreateEnum
CREATE TYPE "PayeeType" AS ENUM ('VENDOR', 'LABOURER', 'OTHER');

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "labourerId" TEXT;

-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN     "legalType" "VendorLegalType" NOT NULL DEFAULT 'OTHER';

-- CreateTable
CREATE TABLE "Labourer" (
    "id" TEXT NOT NULL,
    "tenantId" INTEGER NOT NULL DEFAULT 1,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Labourer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "tenantId" INTEGER NOT NULL DEFAULT 1,
    "projectId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "direction" "StockDirection" NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "unitCost" DECIMAL(14,2),
    "referenceType" "StockReferenceType" NOT NULL,
    "referenceId" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentVoucher" (
    "id" TEXT NOT NULL,
    "tenantId" INTEGER NOT NULL DEFAULT 1,
    "payeeType" "PayeeType" NOT NULL,
    "vendorId" TEXT,
    "labourerId" TEXT,
    "payeeName" TEXT,
    "projectId" TEXT,
    "date" DATE NOT NULL,
    "mode" "PaymentMode" NOT NULL,
    "reference" TEXT,
    "grossAmount" DECIMAL(14,2) NOT NULL,
    "tdsSection" TEXT,
    "tdsRate" DECIMAL(5,2),
    "tdsAmount" DECIMAL(14,2),
    "netPaid" DECIMAL(14,2) NOT NULL,
    "narration" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentVoucher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "tenantId" INTEGER NOT NULL DEFAULT 1,
    "entityType" "AttachmentEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "projectId" TEXT,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Labourer_tenantId_idx" ON "Labourer"("tenantId");

-- CreateIndex
CREATE INDEX "Labourer_tenantId_name_idx" ON "Labourer"("tenantId", "name");

-- CreateIndex
CREATE INDEX "Labourer_tenantId_active_idx" ON "Labourer"("tenantId", "active");

-- CreateIndex
CREATE INDEX "StockMovement_tenantId_idx" ON "StockMovement"("tenantId");

-- CreateIndex
CREATE INDEX "StockMovement_tenantId_projectId_date_idx" ON "StockMovement"("tenantId", "projectId", "date");

-- CreateIndex
CREATE INDEX "StockMovement_tenantId_itemId_date_idx" ON "StockMovement"("tenantId", "itemId", "date");

-- CreateIndex
CREATE INDEX "StockMovement_tenantId_referenceType_referenceId_idx" ON "StockMovement"("tenantId", "referenceType", "referenceId");

-- CreateIndex
CREATE INDEX "PaymentVoucher_tenantId_idx" ON "PaymentVoucher"("tenantId");

-- CreateIndex
CREATE INDEX "PaymentVoucher_tenantId_payeeType_date_idx" ON "PaymentVoucher"("tenantId", "payeeType", "date");

-- CreateIndex
CREATE INDEX "PaymentVoucher_tenantId_vendorId_date_idx" ON "PaymentVoucher"("tenantId", "vendorId", "date");

-- CreateIndex
CREATE INDEX "PaymentVoucher_tenantId_labourerId_date_idx" ON "PaymentVoucher"("tenantId", "labourerId", "date");

-- CreateIndex
CREATE INDEX "PaymentVoucher_tenantId_projectId_date_idx" ON "PaymentVoucher"("tenantId", "projectId", "date");

-- CreateIndex
CREATE INDEX "Attachment_tenantId_idx" ON "Attachment"("tenantId");

-- CreateIndex
CREATE INDEX "Attachment_tenantId_entityType_entityId_idx" ON "Attachment"("tenantId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "Attachment_tenantId_projectId_createdAt_idx" ON "Attachment"("tenantId", "projectId", "createdAt");

-- CreateIndex
CREATE INDEX "Expense_tenantId_labourerId_date_idx" ON "Expense"("tenantId", "labourerId", "date");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_labourerId_fkey" FOREIGN KEY ("labourerId") REFERENCES "Labourer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Labourer" ADD CONSTRAINT "Labourer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentVoucher" ADD CONSTRAINT "PaymentVoucher_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentVoucher" ADD CONSTRAINT "PaymentVoucher_labourerId_fkey" FOREIGN KEY ("labourerId") REFERENCES "Labourer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentVoucher" ADD CONSTRAINT "PaymentVoucher_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentVoucher" ADD CONSTRAINT "PaymentVoucher_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
