-- Add optional stage link on receipts so collections can be tracked stage-wise (bank vs cash).
ALTER TABLE "Receipt" ADD COLUMN "projectPaymentStageId" TEXT;

ALTER TABLE "Receipt"
ADD CONSTRAINT "Receipt_projectPaymentStageId_fkey"
FOREIGN KEY ("projectPaymentStageId") REFERENCES "ProjectPaymentStage"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Receipt_tenantId_projectPaymentStageId_date_idx"
ON "Receipt" ("tenantId", "projectPaymentStageId", "date");

