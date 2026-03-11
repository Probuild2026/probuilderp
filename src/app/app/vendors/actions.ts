"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth/next";
import { Prisma } from "@prisma/client";

import { vendorCreateSchema, vendorMergeSchema, vendorUpdateSchema } from "@/lib/validators/vendor";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

export async function createVendor(input: unknown) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const parsed = vendorCreateSchema.parse(input);
  const trade = parsed.trade?.trim() ? parsed.trade.trim() : null;
  const gstin = parsed.gstin?.trim() ? parsed.gstin.trim() : null;
  const pan = parsed.pan?.trim() ? parsed.pan.trim() : null;
  const phone = parsed.phone?.trim() ? parsed.phone.trim() : null;
  const email = parsed.email?.trim() ? parsed.email.trim() : null;
  const address = parsed.address?.trim() ? parsed.address.trim() : null;
  const beneficiaryName = parsed.beneficiaryName?.trim() ? parsed.beneficiaryName.trim() : null;
  const bankName = parsed.bankName?.trim() ? parsed.bankName.trim() : null;
  const bankBranch = parsed.bankBranch?.trim() ? parsed.bankBranch.trim() : null;
  const bankAccountNumber = parsed.bankAccountNumber?.trim() ? parsed.bankAccountNumber.trim() : null;
  const ifscCode = parsed.ifscCode?.trim() ? parsed.ifscCode.trim().toUpperCase() : null;
  const upiId = parsed.upiId?.trim() ? parsed.upiId.trim() : null;

  await prisma.vendor.create({
    data: {
      tenantId: session.user.tenantId,
      name: parsed.name,
      trade,
      gstin,
      pan,
      phone,
      email,
      address,
      beneficiaryName,
      bankName,
      bankBranch,
      bankAccountNumber,
      ifscCode,
      upiId,
      isSubcontractor: parsed.isSubcontractor,
      legalType: parsed.legalType,
      active: parsed.active,
      tdsSection: parsed.tdsSection,
      tdsOverrideRate: parsed.tdsOverrideRate == null ? null : new Prisma.Decimal(parsed.tdsOverrideRate),
      tdsThresholdSingle: new Prisma.Decimal(parsed.tdsThresholdSingle),
      tdsThresholdAnnual: new Prisma.Decimal(parsed.tdsThresholdAnnual),
      isTransporter: parsed.isTransporter,
      transporterVehicleCount: parsed.isTransporter ? (parsed.transporterVehicleCount ?? null) : null,
    },
  });

  revalidatePath("/app/vendors");
}

export async function updateVendor(input: unknown) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const parsed = vendorUpdateSchema.parse(input);
  const trade = parsed.trade?.trim() ? parsed.trade.trim() : null;
  const gstin = parsed.gstin?.trim() ? parsed.gstin.trim() : null;
  const pan = parsed.pan?.trim() ? parsed.pan.trim() : null;
  const phone = parsed.phone?.trim() ? parsed.phone.trim() : null;
  const email = parsed.email?.trim() ? parsed.email.trim() : null;
  const address = parsed.address?.trim() ? parsed.address.trim() : null;
  const beneficiaryName = parsed.beneficiaryName?.trim() ? parsed.beneficiaryName.trim() : null;
  const bankName = parsed.bankName?.trim() ? parsed.bankName.trim() : null;
  const bankBranch = parsed.bankBranch?.trim() ? parsed.bankBranch.trim() : null;
  const bankAccountNumber = parsed.bankAccountNumber?.trim() ? parsed.bankAccountNumber.trim() : null;
  const ifscCode = parsed.ifscCode?.trim() ? parsed.ifscCode.trim().toUpperCase() : null;
  const upiId = parsed.upiId?.trim() ? parsed.upiId.trim() : null;

  const res = await prisma.vendor.updateMany({
    where: { id: parsed.id, tenantId: session.user.tenantId },
    data: {
      name: parsed.name,
      trade,
      gstin,
      pan,
      phone,
      email,
      address,
      beneficiaryName,
      bankName,
      bankBranch,
      bankAccountNumber,
      ifscCode,
      upiId,
      isSubcontractor: parsed.isSubcontractor,
      legalType: parsed.legalType,
      active: parsed.active,
      tdsSection: parsed.tdsSection,
      tdsOverrideRate: parsed.tdsOverrideRate == null ? null : new Prisma.Decimal(parsed.tdsOverrideRate),
      tdsThresholdSingle: new Prisma.Decimal(parsed.tdsThresholdSingle),
      tdsThresholdAnnual: new Prisma.Decimal(parsed.tdsThresholdAnnual),
      isTransporter: parsed.isTransporter,
      transporterVehicleCount: parsed.isTransporter ? (parsed.transporterVehicleCount ?? null) : null,
    },
  });
  if (res.count === 0) throw new Error("Vendor not found.");

  revalidatePath("/app/vendors");
}

export async function deleteVendor(id: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const tenantId = session.user.tenantId;

  const vendor = await prisma.vendor.findFirst({
    where: { id, tenantId },
    select: { id: true },
  });
  if (!vendor) throw new Error("Vendor not found.");

  const [expenseCount, billCount, paymentCount, transactionCount, voucherCount] = await prisma.$transaction([
    prisma.expense.count({ where: { tenantId, vendorId: id } }),
    prisma.purchaseInvoice.count({ where: { tenantId, vendorId: id } }),
    prisma.vendorPayment.count({ where: { tenantId, vendorId: id } }),
    prisma.transaction.count({ where: { tenantId, vendorId: id } }),
    prisma.paymentVoucher.count({ where: { tenantId, vendorId: id } }),
  ]);

  const linkedParts = [
    expenseCount ? `${expenseCount} expense${expenseCount === 1 ? "" : "s"}` : "",
    billCount ? `${billCount} bill${billCount === 1 ? "" : "s"}` : "",
    paymentCount ? `${paymentCount} payment${paymentCount === 1 ? "" : "s"}` : "",
    transactionCount ? `${transactionCount} transaction${transactionCount === 1 ? "" : "s"}` : "",
    voucherCount ? `${voucherCount} voucher${voucherCount === 1 ? "" : "s"}` : "",
  ].filter(Boolean);

  if (linkedParts.length > 0) {
    throw new Error(`Cannot delete vendor with linked records (${linkedParts.join(", ")}). Merge vendors or remove linked records first.`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.itemVendor.deleteMany({
      where: { tenantId, vendorId: id },
    });
    await tx.vendor.delete({ where: { id } });
  });

  revalidatePath("/app/vendors");
  revalidatePath("/app/items");
}

export async function mergeVendors(input: unknown) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const parsed = vendorMergeSchema.parse(input);
  if (parsed.fromVendorId === parsed.toVendorId) throw new Error("Pick two different vendors.");

  const tenantId = session.user.tenantId;

  await prisma.$transaction(async (tx) => {
    const [fromVendor, toVendor] = await Promise.all([
      tx.vendor.findFirst({ where: { id: parsed.fromVendorId, tenantId } }),
      tx.vendor.findFirst({ where: { id: parsed.toVendorId, tenantId } }),
    ]);

    if (!fromVendor) throw new Error("Source vendor not found.");
    if (!toVendor) throw new Error("Target vendor not found.");

    // If either vendor is linked to a ledger account, keep at most one.
    if (fromVendor.ledgerAccountId && toVendor.ledgerAccountId) {
      throw new Error("Both vendors have ledger links. Remove one ledger link first, then merge.");
    }
    if (fromVendor.ledgerAccountId && !toVendor.ledgerAccountId) {
      await tx.vendor.update({
        where: { id: toVendor.id },
        data: { ledgerAccountId: fromVendor.ledgerAccountId },
      });
    }

    // Prevent PurchaseInvoice unique collisions (tenantId, vendorId, invoiceNumber).
    const invoiceNumbers = await tx.purchaseInvoice.findMany({
      where: { tenantId, vendorId: { in: [fromVendor.id, toVendor.id] } },
      select: { vendorId: true, invoiceNumber: true },
    });
    const fromNumbers = new Set(invoiceNumbers.filter((r) => r.vendorId === fromVendor.id).map((r) => r.invoiceNumber));
    const collisions = invoiceNumbers
      .filter((r) => r.vendorId === toVendor.id)
      .map((r) => r.invoiceNumber)
      .filter((n) => fromNumbers.has(n));
    if (collisions.length) {
      throw new Error(
        `Cannot merge: both vendors have bills with the same invoice number(s): ${collisions
          .slice(0, 5)
          .join(", ")}${collisions.length > 5 ? "…" : ""}. Rename/merge those bills first.`
      );
    }

    await Promise.all([
      tx.transaction.updateMany({
        where: { tenantId, vendorId: fromVendor.id },
        data: { vendorId: toVendor.id },
      }),
      tx.expense.updateMany({
        where: { tenantId, vendorId: fromVendor.id },
        data: { vendorId: toVendor.id },
      }),
      tx.purchaseInvoice.updateMany({
        where: { tenantId, vendorId: fromVendor.id },
        data: { vendorId: toVendor.id },
      }),
      tx.vendorPayment.updateMany({
        where: { tenantId, vendorId: fromVendor.id },
        data: { vendorId: toVendor.id },
      }),
      tx.paymentVoucher.updateMany({
        where: { tenantId, vendorId: fromVendor.id },
        data: { vendorId: toVendor.id },
      }),
    ]);

    await tx.vendor.delete({ where: { id: fromVendor.id } });
  });

  revalidatePath("/app/vendors");
  revalidatePath("/app/purchases/payments-made");
  revalidatePath("/app/purchases/bills");
  revalidatePath("/app/expenses");
  revalidatePath("/app/transactions");
}
