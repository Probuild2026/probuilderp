-- Add formal supplier invoice follow-up status for purchase bills.
CREATE TYPE "PurchaseInvoiceStatus" AS ENUM ('PENDING', 'CONFIRMED');

ALTER TABLE "PurchaseInvoice"
ADD COLUMN "invoiceStatus" "PurchaseInvoiceStatus" NOT NULL DEFAULT 'CONFIRMED';

CREATE INDEX "PurchaseInvoice_tenantId_invoiceStatus_idx" ON "PurchaseInvoice"("tenantId", "invoiceStatus");

-- Track TDS challan/deposit details directly against vendor payment transactions.
CREATE TYPE "TdsDepositStatus" AS ENUM ('PENDING', 'DEPOSITED');

ALTER TABLE "Transaction"
ADD COLUMN "tdsSection" TEXT,
ADD COLUMN "tdsDepositStatus" "TdsDepositStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "tdsChallanCin" TEXT,
ADD COLUMN "tdsChallanBsrCode" TEXT,
ADD COLUMN "tdsChallanNumber" TEXT,
ADD COLUMN "tdsChallanDate" DATE;

CREATE INDEX "Transaction_tenantId_tdsDepositStatus_idx" ON "Transaction"("tenantId", "tdsDepositStatus");
CREATE INDEX "Transaction_tenantId_tdsChallanDate_idx" ON "Transaction"("tenantId", "tdsChallanDate");
