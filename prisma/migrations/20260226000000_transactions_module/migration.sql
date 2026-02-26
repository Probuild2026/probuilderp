-- CreateEnum
CREATE TYPE "FinanceAccountType" AS ENUM ('CASH', 'BANK', 'UPI', 'CARD', 'OTHER');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('INCOME', 'EXPENSE', 'TRANSFER');

-- AlterEnum
ALTER TYPE "AttachmentEntityType" ADD VALUE 'TRANSACTION';

-- CreateTable
CREATE TABLE "FinanceAccount" (
    "id" TEXT NOT NULL,
    "tenantId" INTEGER NOT NULL DEFAULT 1,
    "name" TEXT NOT NULL,
    "type" "FinanceAccountType" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TxnCategory" (
    "id" TEXT NOT NULL,
    "tenantId" INTEGER NOT NULL DEFAULT 1,
    "name" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TxnCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "tenantId" INTEGER NOT NULL DEFAULT 1,
    "type" "TransactionType" NOT NULL,
    "date" DATE NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "projectId" TEXT,
    "categoryId" TEXT,
    "fromAccountId" TEXT,
    "toAccountId" TEXT,
    "note" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FinanceAccount_tenantId_idx" ON "FinanceAccount"("tenantId");

-- CreateIndex
CREATE INDEX "FinanceAccount_tenantId_type_idx" ON "FinanceAccount"("tenantId", "type");

-- CreateIndex
CREATE INDEX "FinanceAccount_tenantId_active_idx" ON "FinanceAccount"("tenantId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceAccount_tenantId_name_key" ON "FinanceAccount"("tenantId", "name");

-- CreateIndex
CREATE INDEX "TxnCategory_tenantId_idx" ON "TxnCategory"("tenantId");

-- CreateIndex
CREATE INDEX "TxnCategory_tenantId_type_idx" ON "TxnCategory"("tenantId", "type");

-- CreateIndex
CREATE INDEX "TxnCategory_tenantId_active_idx" ON "TxnCategory"("tenantId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "TxnCategory_tenantId_type_name_key" ON "TxnCategory"("tenantId", "type", "name");

-- CreateIndex
CREATE INDEX "Transaction_tenantId_idx" ON "Transaction"("tenantId");

-- CreateIndex
CREATE INDEX "Transaction_tenantId_date_idx" ON "Transaction"("tenantId", "date");

-- CreateIndex
CREATE INDEX "Transaction_tenantId_type_date_idx" ON "Transaction"("tenantId", "type", "date");

-- CreateIndex
CREATE INDEX "Transaction_tenantId_projectId_date_idx" ON "Transaction"("tenantId", "projectId", "date");

-- CreateIndex
CREATE INDEX "Transaction_tenantId_fromAccountId_date_idx" ON "Transaction"("tenantId", "fromAccountId", "date");

-- CreateIndex
CREATE INDEX "Transaction_tenantId_toAccountId_date_idx" ON "Transaction"("tenantId", "toAccountId", "date");

-- CreateIndex
CREATE INDEX "Transaction_tenantId_categoryId_date_idx" ON "Transaction"("tenantId", "categoryId", "date");

-- AddForeignKey
ALTER TABLE "FinanceAccount" ADD CONSTRAINT "FinanceAccount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TxnCategory" ADD CONSTRAINT "TxnCategory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "TxnCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_fromAccountId_fkey" FOREIGN KEY ("fromAccountId") REFERENCES "FinanceAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_toAccountId_fkey" FOREIGN KEY ("toAccountId") REFERENCES "FinanceAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

