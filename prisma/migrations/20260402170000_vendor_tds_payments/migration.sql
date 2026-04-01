-- CreateTable
CREATE TABLE "VendorTdsPayment" (
    "id" TEXT NOT NULL,
    "tenantId" INTEGER NOT NULL DEFAULT 1,
    "vendorId" TEXT NOT NULL,
    "fy" TEXT NOT NULL,
    "section" TEXT NOT NULL DEFAULT '194C',
    "challanNo" TEXT,
    "periodFrom" DATE,
    "periodTo" DATE,
    "tdsPaidAmount" DECIMAL(14,2) NOT NULL,
    "paymentDate" DATE NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorTdsPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VendorTdsPayment_tenantId_idx" ON "VendorTdsPayment"("tenantId");

-- CreateIndex
CREATE INDEX "VendorTdsPayment_tenantId_vendorId_paymentDate_idx" ON "VendorTdsPayment"("tenantId", "vendorId", "paymentDate");

-- CreateIndex
CREATE INDEX "VendorTdsPayment_tenantId_fy_idx" ON "VendorTdsPayment"("tenantId", "fy");

-- AddForeignKey
ALTER TABLE "VendorTdsPayment" ADD CONSTRAINT "VendorTdsPayment_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorTdsPayment" ADD CONSTRAINT "VendorTdsPayment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
