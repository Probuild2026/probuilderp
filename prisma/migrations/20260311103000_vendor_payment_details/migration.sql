-- AlterTable
ALTER TABLE "Vendor"
ADD COLUMN "beneficiaryName" TEXT,
ADD COLUMN "bankName" TEXT,
ADD COLUMN "bankBranch" TEXT,
ADD COLUMN "bankAccountNumber" TEXT,
ADD COLUMN "ifscCode" TEXT,
ADD COLUMN "upiId" TEXT;
