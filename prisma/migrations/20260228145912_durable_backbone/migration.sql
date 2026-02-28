-- CreateEnum
CREATE TYPE "TransactionDirection" AS ENUM ('IN', 'OUT', 'TRANSFER');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PARTIAL', 'PAID', 'CANCELLED');

-- AlterEnum
BEGIN;
CREATE TYPE "AttachmentEntityType_new" AS ENUM ('EXPENSE', 'PURCHASE_INVOICE', 'INVOICE', 'PAYMENT_VOUCHER', 'LABOUR_PAYMENT', 'TRANSACTION', 'TENANT_PROFILE');
ALTER TABLE "Attachment" ALTER COLUMN "entityType" TYPE "AttachmentEntityType_new" USING ("entityType"::text::"AttachmentEntityType_new");
ALTER TYPE "AttachmentEntityType" RENAME TO "AttachmentEntityType_old";
ALTER TYPE "AttachmentEntityType_new" RENAME TO "AttachmentEntityType";
DROP TYPE "AttachmentEntityType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "Expense" DROP CONSTRAINT "Expense_vendorId_fkey";

-- DropForeignKey
ALTER TABLE "Expense" DROP CONSTRAINT "Expense_labourerId_fkey";

-- DropForeignKey
ALTER TABLE "TransactionAllocation" DROP CONSTRAINT "TransactionAllocation_transactionId_fkey";

-- DropForeignKey
ALTER TABLE "TransactionAllocation" DROP CONSTRAINT "TransactionAllocation_projectId_fkey";

-- DropForeignKey
ALTER TABLE "TransactionAllocation" DROP CONSTRAINT "TransactionAllocation_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "ClientInvoice" DROP CONSTRAINT "ClientInvoice_clientId_fkey";

-- DropForeignKey
ALTER TABLE "ClientInvoice" DROP CONSTRAINT "ClientInvoice_projectId_fkey";

-- DropForeignKey
ALTER TABLE "ClientInvoice" DROP CONSTRAINT "ClientInvoice_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "Receipt" DROP CONSTRAINT "Receipt_clientInvoiceId_fkey";

-- DropForeignKey
ALTER TABLE "Receipt" DROP CONSTRAINT "Receipt_transactionId_fkey";

-- DropForeignKey
ALTER TABLE "Receipt" DROP CONSTRAINT "Receipt_tenantId_fkey";

-- DropIndex
DROP INDEX "Expense_tenantId_projectId_date_idx";

-- DropIndex
DROP INDEX "Expense_tenantId_vendorId_date_idx";

-- DropIndex
DROP INDEX "Expense_tenantId_labourerId_date_idx";

-- DropIndex
DROP INDEX "Expense_tenantId_expenseType_idx";

-- DropIndex
DROP INDEX "TxnCategory_tenantId_type_idx";

-- DropIndex
DROP INDEX "TxnCategory_tenantId_type_name_key";

-- DropIndex
DROP INDEX "Transaction_tenantId_type_date_idx";

-- AlterTable
ALTER TABLE "Expense" DROP COLUMN "amountBeforeTax",
DROP COLUMN "date",
DROP COLUMN "expenseType",
DROP COLUMN "labourerId",
DROP COLUMN "paymentMode",
DROP COLUMN "paymentStatus",
DROP COLUMN "totalAmount",
ADD COLUMN     "billDate" DATE NOT NULL,
ADD COLUMN     "billNo" TEXT,
ADD COLUMN     "category" "ExpenseType" NOT NULL,
ADD COLUMN     "dueDate" DATE,
ADD COLUMN     "subtotal" DECIMAL(14,2) NOT NULL,
ADD COLUMN     "total" DECIMAL(14,2) NOT NULL,
ALTER COLUMN "vendorId" SET NOT NULL;

-- AlterTable
ALTER TABLE "TxnCategory" DROP COLUMN "type",
ADD COLUMN     "direction" "TransactionDirection" NOT NULL;

-- AlterTable
ALTER TABLE "Transaction" DROP COLUMN "type",
ADD COLUMN     "clientId" TEXT,
ADD COLUMN     "direction" "TransactionDirection" NOT NULL,
ADD COLUMN     "mode" "PaymentMode" NOT NULL,
ADD COLUMN     "reference" TEXT,
ADD COLUMN     "tdsAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "vendorId" TEXT;

-- DropTable
DROP TABLE "TransactionAllocation";

-- DropTable
DROP TABLE "ClientInvoice";

-- DropTable
DROP TABLE "Receipt";

-- DropEnum
DROP TYPE "TransactionType";

-- DropEnum
DROP TYPE "AllocationDocumentType";

-- CreateTable
CREATE TABLE "Allocation" (
    "id" TEXT NOT NULL,
    "tenantId" INTEGER NOT NULL DEFAULT 1,
    "transactionId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "expenseId" TEXT,
    "cashAmount" DECIMAL(14,2) NOT NULL,
    "tdsAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Allocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "tenantId" INTEGER NOT NULL DEFAULT 1,
    "clientId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "invoiceNo" TEXT NOT NULL,
    "invoiceDate" DATE NOT NULL,
    "dueDate" DATE,
    "serviceDescription" TEXT,
    "sacCode" TEXT,
    "gstRate" DECIMAL(5,2),
    "subtotal" DECIMAL(14,2) NOT NULL,
    "gstType" "GstType" NOT NULL,
    "cgst" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "sgst" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "igst" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL,
    "tdsRate" DECIMAL(5,2),
    "tdsAmountExpected" DECIMAL(14,2),
    "tdsCertificateNumber" TEXT,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'ISSUED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Allocation_tenantId_idx" ON "Allocation"("tenantId");

-- CreateIndex
CREATE INDEX "Allocation_tenantId_transactionId_idx" ON "Allocation"("tenantId", "transactionId");

-- CreateIndex
CREATE INDEX "Allocation_tenantId_invoiceId_idx" ON "Allocation"("tenantId", "invoiceId");

-- CreateIndex
CREATE INDEX "Allocation_tenantId_expenseId_idx" ON "Allocation"("tenantId", "expenseId");

-- CreateIndex
CREATE INDEX "Invoice_tenantId_idx" ON "Invoice"("tenantId");

-- CreateIndex
CREATE INDEX "Invoice_tenantId_clientId_invoiceDate_idx" ON "Invoice"("tenantId", "clientId", "invoiceDate");

-- CreateIndex
CREATE INDEX "Invoice_tenantId_projectId_invoiceDate_idx" ON "Invoice"("tenantId", "projectId", "invoiceDate");

-- CreateIndex
CREATE INDEX "Invoice_tenantId_status_idx" ON "Invoice"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_tenantId_projectId_invoiceNo_key" ON "Invoice"("tenantId", "projectId", "invoiceNo");

-- CreateIndex
CREATE INDEX "Expense_tenantId_projectId_billDate_idx" ON "Expense"("tenantId", "projectId", "billDate");

-- CreateIndex
CREATE INDEX "Expense_tenantId_vendorId_billDate_idx" ON "Expense"("tenantId", "vendorId", "billDate");

-- CreateIndex
CREATE INDEX "Expense_tenantId_category_idx" ON "Expense"("tenantId", "category");

-- CreateIndex
CREATE INDEX "TxnCategory_tenantId_direction_idx" ON "TxnCategory"("tenantId", "direction");

-- CreateIndex
CREATE UNIQUE INDEX "TxnCategory_tenantId_direction_name_key" ON "TxnCategory"("tenantId", "direction", "name");

-- CreateIndex
CREATE INDEX "Transaction_tenantId_direction_date_idx" ON "Transaction"("tenantId", "direction", "date");

-- CreateIndex
CREATE INDEX "Transaction_tenantId_clientId_date_idx" ON "Transaction"("tenantId", "clientId", "date");

-- CreateIndex
CREATE INDEX "Transaction_tenantId_vendorId_date_idx" ON "Transaction"("tenantId", "vendorId", "date");

-- CreateIndex
CREATE INDEX "Transaction_tenantId_mode_date_idx" ON "Transaction"("tenantId", "mode", "date");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Allocation" ADD CONSTRAINT "Allocation_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Allocation" ADD CONSTRAINT "Allocation_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Allocation" ADD CONSTRAINT "Allocation_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Allocation" ADD CONSTRAINT "Allocation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

