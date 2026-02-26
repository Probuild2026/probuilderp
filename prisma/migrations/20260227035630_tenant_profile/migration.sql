-- Add TenantProfile (business settings) and allow storing a logo as an attachment type.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'AttachmentEntityType'
      AND e.enumlabel = 'TENANT_PROFILE'
  ) THEN
    ALTER TYPE "AttachmentEntityType" ADD VALUE 'TENANT_PROFILE';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "TenantProfile" (
  "id" TEXT NOT NULL,
  "tenantId" INTEGER NOT NULL DEFAULT 1,
  "legalName" TEXT NOT NULL,
  "tradeName" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "address" TEXT,
  "gstin" TEXT,
  "pan" TEXT,
  "bankName" TEXT,
  "bankAccountNo" TEXT,
  "bankIfsc" TEXT,
  "upiId" TEXT,
  "logoUrl" TEXT,
  "logoName" TEXT,
  "logoMimeType" TEXT,
  "logoSize" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TenantProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TenantProfile_tenantId_key" ON "TenantProfile"("tenantId");
CREATE INDEX IF NOT EXISTS "TenantProfile_tenantId_idx" ON "TenantProfile"("tenantId");
CREATE INDEX IF NOT EXISTS "TenantProfile_tenantId_gstin_idx" ON "TenantProfile"("tenantId", "gstin");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'TenantProfile_tenantId_fkey'
  ) THEN
    ALTER TABLE "TenantProfile"
      ADD CONSTRAINT "TenantProfile_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

