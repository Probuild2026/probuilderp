-- CreateTable
CREATE TABLE "ProjectPaymentStage" (
    "id" TEXT NOT NULL,
    "tenantId" INTEGER NOT NULL DEFAULT 1,
    "projectId" TEXT NOT NULL,
    "stageName" TEXT NOT NULL,
    "scopeOfWork" TEXT,
    "percent" DECIMAL(5,2),
    "expectedAmount" DECIMAL(14,2) NOT NULL,
    "expectedBank" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "expectedCash" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "actualBank" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "actualCash" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "expectedDate" DATE,
    "actualDate" DATE,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectPaymentStage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectPaymentStage_tenantId_idx" ON "ProjectPaymentStage"("tenantId");

-- CreateIndex
CREATE INDEX "ProjectPaymentStage_tenantId_projectId_sortOrder_idx" ON "ProjectPaymentStage"("tenantId", "projectId", "sortOrder");

-- CreateIndex
CREATE INDEX "ProjectPaymentStage_tenantId_projectId_stageName_idx" ON "ProjectPaymentStage"("tenantId", "projectId", "stageName");

-- AddForeignKey
ALTER TABLE "ProjectPaymentStage" ADD CONSTRAINT "ProjectPaymentStage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectPaymentStage" ADD CONSTRAINT "ProjectPaymentStage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

