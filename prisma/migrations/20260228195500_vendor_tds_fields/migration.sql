-- Add vendor TDS + transporter settings (safe, additive).

ALTER TABLE "Vendor" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Vendor" ADD COLUMN "tdsSection" TEXT NOT NULL DEFAULT '194C';
ALTER TABLE "Vendor" ADD COLUMN "tdsOverrideRate" DECIMAL(5,2);
ALTER TABLE "Vendor" ADD COLUMN "tdsThresholdSingle" DECIMAL(14,2) NOT NULL DEFAULT 30000;
ALTER TABLE "Vendor" ADD COLUMN "tdsThresholdAnnual" DECIMAL(14,2) NOT NULL DEFAULT 100000;

ALTER TABLE "Vendor" ADD COLUMN "isTransporter" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Vendor" ADD COLUMN "transporterVehicleCount" INTEGER;

