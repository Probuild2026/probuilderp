-- Add invoice fields needed for GST invoices (description, SAC, GST rate).

ALTER TABLE "ClientInvoice"
  ADD COLUMN IF NOT EXISTS "serviceDescription" TEXT,
  ADD COLUMN IF NOT EXISTS "sacCode" TEXT,
  ADD COLUMN IF NOT EXISTS "gstRate" DECIMAL(5,2);

