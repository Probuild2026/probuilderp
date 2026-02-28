-- Patch Transaction table to match the current Prisma schema (additive + safe).
-- This fixes production/runtime errors where Prisma selects columns that don't yet exist
-- (e.g. `mode`, `reference`, `clientId`, `vendorId`).

ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "clientId" TEXT;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "vendorId" TEXT;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "mode" "PaymentMode";
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "reference" TEXT;

CREATE INDEX IF NOT EXISTS "Transaction_tenantId_clientId_date_idx"
  ON "Transaction" ("tenantId", "clientId", "date");

CREATE INDEX IF NOT EXISTS "Transaction_tenantId_vendorId_date_idx"
  ON "Transaction" ("tenantId", "vendorId", "date");

CREATE INDEX IF NOT EXISTS "Transaction_tenantId_mode_date_idx"
  ON "Transaction" ("tenantId", "mode", "date");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Transaction_clientId_fkey'
  ) THEN
    ALTER TABLE "Transaction"
      ADD CONSTRAINT "Transaction_clientId_fkey"
      FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Transaction_vendorId_fkey'
  ) THEN
    ALTER TABLE "Transaction"
      ADD CONSTRAINT "Transaction_vendorId_fkey"
      FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

