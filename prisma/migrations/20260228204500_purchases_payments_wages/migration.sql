-- Purchases payments + labour sheets (additive, safe).

-- 1) Extend allocation enum to allow allocating payments to PurchaseInvoice.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'AllocationDocumentType' AND e.enumlabel = 'PURCHASE_INVOICE'
  ) THEN
    ALTER TYPE "AllocationDocumentType" ADD VALUE 'PURCHASE_INVOICE';
  END IF;
END $$;

-- 2) Track taxable base used for TDS threshold checks.
ALTER TABLE "Transaction" ADD COLUMN "tdsBaseAmount" DECIMAL(14,2) NOT NULL DEFAULT 0;

-- 3) Direct labour sheets (no 194C).
CREATE TABLE "LabourSheet" (
  "id" TEXT NOT NULL,
  "tenantId" INTEGER NOT NULL DEFAULT 1,
  "projectId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "mode" "PaymentMode" NOT NULL,
  "reference" TEXT,
  "note" TEXT,
  "total" DECIMAL(14,2) NOT NULL,
  "transactionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "LabourSheet_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LabourSheetLine" (
  "id" TEXT NOT NULL,
  "tenantId" INTEGER NOT NULL DEFAULT 1,
  "labourSheetId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "headcount" INTEGER NOT NULL DEFAULT 1,
  "rate" DECIMAL(14,2) NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "LabourSheetLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LabourSheet_transactionId_key" ON "LabourSheet"("transactionId");
CREATE INDEX "LabourSheet_tenantId_idx" ON "LabourSheet"("tenantId");
CREATE INDEX "LabourSheet_tenantId_projectId_date_idx" ON "LabourSheet"("tenantId", "projectId", "date");
CREATE INDEX "LabourSheetLine_tenantId_idx" ON "LabourSheetLine"("tenantId");
CREATE INDEX "LabourSheetLine_tenantId_labourSheetId_idx" ON "LabourSheetLine"("tenantId", "labourSheetId");

ALTER TABLE "LabourSheet"
  ADD CONSTRAINT "LabourSheet_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LabourSheet"
  ADD CONSTRAINT "LabourSheet_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LabourSheet"
  ADD CONSTRAINT "LabourSheet_transactionId_fkey"
  FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LabourSheetLine"
  ADD CONSTRAINT "LabourSheetLine_labourSheetId_fkey"
  FOREIGN KEY ("labourSheetId") REFERENCES "LabourSheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LabourSheetLine"
  ADD CONSTRAINT "LabourSheetLine_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

