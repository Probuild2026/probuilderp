-- Allocation-based payments
-- Adds TransactionAllocation and links Receipt -> Transaction.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AllocationDocumentType') THEN
    CREATE TYPE "AllocationDocumentType" AS ENUM ('CLIENT_INVOICE', 'EXPENSE');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "TransactionAllocation" (
  "id" TEXT NOT NULL,
  "tenantId" INTEGER NOT NULL DEFAULT 1,
  "transactionId" TEXT NOT NULL,
  "documentType" "AllocationDocumentType" NOT NULL,
  "documentId" TEXT NOT NULL,
  "projectId" TEXT,
  "cashAmount" DECIMAL(14,2) NOT NULL,
  "tdsAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "grossAmount" DECIMAL(14,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TransactionAllocation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TransactionAllocation_tenantId_idx" ON "TransactionAllocation"("tenantId");
CREATE INDEX IF NOT EXISTS "TransactionAllocation_tenantId_transactionId_idx" ON "TransactionAllocation"("tenantId", "transactionId");
CREATE INDEX IF NOT EXISTS "TransactionAllocation_tenantId_documentType_documentId_idx" ON "TransactionAllocation"("tenantId", "documentType", "documentId");
CREATE INDEX IF NOT EXISTS "TransactionAllocation_tenantId_projectId_createdAt_idx" ON "TransactionAllocation"("tenantId", "projectId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TransactionAllocation_tenantId_fkey') THEN
    ALTER TABLE "TransactionAllocation"
      ADD CONSTRAINT "TransactionAllocation_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TransactionAllocation_transactionId_fkey') THEN
    ALTER TABLE "TransactionAllocation"
      ADD CONSTRAINT "TransactionAllocation_transactionId_fkey"
      FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TransactionAllocation_projectId_fkey') THEN
    ALTER TABLE "TransactionAllocation"
      ADD CONSTRAINT "TransactionAllocation_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "Project"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "Receipt"
  ADD COLUMN IF NOT EXISTS "transactionId" TEXT;

CREATE INDEX IF NOT EXISTS "Receipt_tenantId_transactionId_idx" ON "Receipt"("tenantId", "transactionId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Receipt_transactionId_fkey') THEN
    ALTER TABLE "Receipt"
      ADD CONSTRAINT "Receipt_transactionId_fkey"
      FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

