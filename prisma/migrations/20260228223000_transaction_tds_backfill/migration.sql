-- Ensure Transaction has TDS columns, then backfill from allocations.
-- This is safe to run on an existing database (additive + idempotent).

ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "tdsAmount" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "tdsBaseAmount" DECIMAL(14,2) NOT NULL DEFAULT 0;

-- Backfill tdsAmount = sum(TransactionAllocation.tdsAmount) per transaction.
WITH tds AS (
  SELECT
    "transactionId" AS tid,
    COALESCE(SUM("tdsAmount"), 0) AS sum_tds
  FROM "TransactionAllocation"
  GROUP BY "transactionId"
)
UPDATE "Transaction" t
SET "tdsAmount" = tds.sum_tds
FROM tds
WHERE t.id = tds.tid;

-- Backfill tdsBaseAmount from allocations + document taxable ratios:
-- - EXPENSE: gross * (amountBeforeTax / totalAmount)
-- - PURCHASE_INVOICE: gross * (taxableValue / total)
WITH base AS (
  SELECT
    ta."transactionId" AS tid,
    COALESCE(SUM(
      CASE
        WHEN ta."documentType" = 'EXPENSE' THEN
          CASE
            WHEN e."totalAmount" IS NOT NULL AND e."totalAmount" <> 0
              THEN ta."grossAmount" * (e."amountBeforeTax" / e."totalAmount")
            ELSE ta."grossAmount"
          END
        WHEN ta."documentType" = 'PURCHASE_INVOICE' THEN
          CASE
            WHEN pi."total" IS NOT NULL AND pi."total" <> 0
              THEN ta."grossAmount" * (pi."taxableValue" / pi."total")
            ELSE ta."grossAmount"
          END
        ELSE 0
      END
    ), 0) AS sum_base
  FROM "TransactionAllocation" ta
  LEFT JOIN "Expense" e
    ON e.id = ta."documentId" AND ta."documentType" = 'EXPENSE'
  LEFT JOIN "PurchaseInvoice" pi
    ON pi.id = ta."documentId" AND ta."documentType" = 'PURCHASE_INVOICE'
  GROUP BY ta."transactionId"
)
UPDATE "Transaction" t
SET "tdsBaseAmount" = base.sum_base
FROM base
WHERE t.id = base.tid;

