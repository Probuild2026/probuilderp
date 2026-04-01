CREATE TYPE "ApprovalStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'CANCELLED');

ALTER TABLE "Expense"
ADD COLUMN "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'APPROVED';

ALTER TABLE "Transaction"
ADD COLUMN "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'APPROVED';

ALTER TABLE "LabourSheet"
ADD COLUMN "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'APPROVED';

ALTER TABLE "PurchaseInvoice"
ADD COLUMN "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'APPROVED';

ALTER TABLE "Receipt"
ADD COLUMN "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'APPROVED';

CREATE INDEX "Expense_tenantId_approvalStatus_idx" ON "Expense"("tenantId", "approvalStatus");
CREATE INDEX "Transaction_tenantId_approvalStatus_idx" ON "Transaction"("tenantId", "approvalStatus");
CREATE INDEX "LabourSheet_tenantId_approvalStatus_idx" ON "LabourSheet"("tenantId", "approvalStatus");
CREATE INDEX "PurchaseInvoice_tenantId_approvalStatus_idx" ON "PurchaseInvoice"("tenantId", "approvalStatus");
CREATE INDEX "Receipt_tenantId_approvalStatus_idx" ON "Receipt"("tenantId", "approvalStatus");
