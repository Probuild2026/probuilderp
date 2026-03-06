-- CreateEnum
CREATE TYPE "PartnerRemunerationType" AS ENUM ('SALARY', 'BONUS', 'COMMISSION', 'OTHER');

-- CreateEnum
CREATE TYPE "PartnerTdsStatus" AS ENUM ('NOT_APPLICABLE', 'TO_BE_DEDUCTED', 'DEDUCTED_NOT_PAID', 'PAID');

-- CreateTable
CREATE TABLE "Partner" (
    "id" TEXT NOT NULL,
    "tenantId" INTEGER NOT NULL DEFAULT 1,
    "name" TEXT NOT NULL,
    "pan" TEXT,
    "profitRatio" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "capitalContribution" DECIMAL(14,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerRemuneration" (
    "id" TEXT NOT NULL,
    "tenantId" INTEGER NOT NULL DEFAULT 1,
    "partnerId" TEXT NOT NULL,
    "projectId" TEXT,
    "date" DATE NOT NULL,
    "type" "PartnerRemunerationType" NOT NULL,
    "grossAmount" DECIMAL(14,2) NOT NULL,
    "tdsRate" DECIMAL(5,2) NOT NULL DEFAULT 10,
    "tdsAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "netPayable" DECIMAL(14,2) NOT NULL,
    "paymentMode" "PaymentMode",
    "paymentDate" DATE,
    "tdsStatus" "PartnerTdsStatus" NOT NULL DEFAULT 'NOT_APPLICABLE',
    "fy" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerRemuneration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerDrawing" (
    "id" TEXT NOT NULL,
    "tenantId" INTEGER NOT NULL DEFAULT 1,
    "partnerId" TEXT NOT NULL,
    "projectId" TEXT,
    "date" DATE NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "mode" "PaymentMode" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerDrawing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerTdsPayment" (
    "id" TEXT NOT NULL,
    "tenantId" INTEGER NOT NULL DEFAULT 1,
    "partnerId" TEXT NOT NULL,
    "fy" TEXT NOT NULL,
    "section" TEXT NOT NULL DEFAULT '194T',
    "challanNo" TEXT,
    "periodFrom" DATE,
    "periodTo" DATE,
    "tdsPaidAmount" DECIMAL(14,2) NOT NULL,
    "paymentDate" DATE NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerTdsPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectProfitAllocation" (
    "id" TEXT NOT NULL,
    "tenantId" INTEGER NOT NULL DEFAULT 1,
    "projectId" TEXT NOT NULL,
    "fy" TEXT NOT NULL,
    "profitBeforePartner" DECIMAL(14,2) NOT NULL,
    "totalPartnerRemu" DECIMAL(14,2) NOT NULL,
    "profitAfterRemu" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectProfitAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Partner_tenantId_idx" ON "Partner"("tenantId");

-- CreateIndex
CREATE INDEX "Partner_tenantId_name_idx" ON "Partner"("tenantId", "name");

-- CreateIndex
CREATE INDEX "Partner_tenantId_isActive_idx" ON "Partner"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "PartnerRemuneration_tenantId_idx" ON "PartnerRemuneration"("tenantId");

-- CreateIndex
CREATE INDEX "PartnerRemuneration_tenantId_partnerId_date_idx" ON "PartnerRemuneration"("tenantId", "partnerId", "date");

-- CreateIndex
CREATE INDEX "PartnerRemuneration_tenantId_projectId_date_idx" ON "PartnerRemuneration"("tenantId", "projectId", "date");

-- CreateIndex
CREATE INDEX "PartnerRemuneration_tenantId_fy_idx" ON "PartnerRemuneration"("tenantId", "fy");

-- CreateIndex
CREATE INDEX "PartnerDrawing_tenantId_idx" ON "PartnerDrawing"("tenantId");

-- CreateIndex
CREATE INDEX "PartnerDrawing_tenantId_partnerId_date_idx" ON "PartnerDrawing"("tenantId", "partnerId", "date");

-- CreateIndex
CREATE INDEX "PartnerDrawing_tenantId_projectId_date_idx" ON "PartnerDrawing"("tenantId", "projectId", "date");

-- CreateIndex
CREATE INDEX "PartnerTdsPayment_tenantId_idx" ON "PartnerTdsPayment"("tenantId");

-- CreateIndex
CREATE INDEX "PartnerTdsPayment_tenantId_partnerId_paymentDate_idx" ON "PartnerTdsPayment"("tenantId", "partnerId", "paymentDate");

-- CreateIndex
CREATE INDEX "PartnerTdsPayment_tenantId_fy_idx" ON "PartnerTdsPayment"("tenantId", "fy");

-- CreateIndex
CREATE INDEX "ProjectProfitAllocation_tenantId_idx" ON "ProjectProfitAllocation"("tenantId");

-- CreateIndex
CREATE INDEX "ProjectProfitAllocation_tenantId_projectId_idx" ON "ProjectProfitAllocation"("tenantId", "projectId");

-- CreateIndex
CREATE INDEX "ProjectProfitAllocation_tenantId_fy_idx" ON "ProjectProfitAllocation"("tenantId", "fy");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectProfitAllocation_tenantId_projectId_fy_key" ON "ProjectProfitAllocation"("tenantId", "projectId", "fy");

-- AddForeignKey
ALTER TABLE "Partner" ADD CONSTRAINT "Partner_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerRemuneration" ADD CONSTRAINT "PartnerRemuneration_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerRemuneration" ADD CONSTRAINT "PartnerRemuneration_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerRemuneration" ADD CONSTRAINT "PartnerRemuneration_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerDrawing" ADD CONSTRAINT "PartnerDrawing_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerDrawing" ADD CONSTRAINT "PartnerDrawing_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerDrawing" ADD CONSTRAINT "PartnerDrawing_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerTdsPayment" ADD CONSTRAINT "PartnerTdsPayment_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerTdsPayment" ADD CONSTRAINT "PartnerTdsPayment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectProfitAllocation" ADD CONSTRAINT "ProjectProfitAllocation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectProfitAllocation" ADD CONSTRAINT "ProjectProfitAllocation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
