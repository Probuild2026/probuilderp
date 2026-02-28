import { PrismaClient, type Prisma, UserRole } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

const TENANT_ID = 1;

const ledgerAccounts: Array<Pick<Prisma.LedgerAccountCreateInput, "name" | "type" | "group">> = [
  { name: "Bank", type: "ASSET", group: "Cash & Bank" },
  { name: "Accounts Receivable", type: "ASSET", group: "Sundry Debtors" },
  { name: "TDS Receivable", type: "ASSET", group: "Duties & Taxes" },

  { name: "Accounts Payable", type: "LIABILITY", group: "Sundry Creditors" },
  { name: "TDS Payable", type: "LIABILITY", group: "Duties & Taxes" },
  { name: "Output GST - CGST", type: "LIABILITY", group: "GST Output" },
  { name: "Output GST - SGST", type: "LIABILITY", group: "GST Output" },
  { name: "Output GST - IGST", type: "LIABILITY", group: "GST Output" },

  { name: "Construction Income", type: "INCOME", group: "Revenue" },

  { name: "Input GST - CGST", type: "ASSET", group: "GST Input" },
  { name: "Input GST - SGST", type: "ASSET", group: "GST Input" },
  { name: "Input GST - IGST", type: "ASSET", group: "GST Input" },

  { name: "Material Expense", type: "EXPENSE", group: "Direct Costs" },
  { name: "Labour Expense", type: "EXPENSE", group: "Direct Costs" },
  { name: "Subcontractor Expense", type: "EXPENSE", group: "Direct Costs" },
  { name: "Overhead Expense", type: "EXPENSE", group: "Overheads" },
];

const financeAccounts: Array<Pick<Prisma.FinanceAccountCreateInput, "name" | "type">> = [
  { name: "Cash", type: "CASH" },
  { name: "Bank", type: "BANK" },
  { name: "UPI (GPay)", type: "UPI" },
  { name: "Card", type: "CARD" },
];

const txnCategories: Array<Pick<Prisma.TxnCategoryCreateInput, "name" | "direction">> = [
  { name: "Payment from Client", direction: "IN" },
  { name: "Petty Cash", direction: "IN" },
  { name: "Other", direction: "IN" },

  { name: "Material Purchase", direction: "OUT" },
  { name: "Labour Payment", direction: "OUT" },
  { name: "Rental Payments", direction: "OUT" },
  { name: "Demolition & Excavation", direction: "OUT" },
  { name: "Transport", direction: "OUT" },
  { name: "Miscellaneous", direction: "OUT" },
  { name: "Other", direction: "OUT" },

  { name: "Fees", direction: "TRANSFER" },
];

async function main() {
  await prisma.tenant.upsert({
    where: { id: TENANT_ID },
    update: { name: "Probuild" },
    create: { id: TENANT_ID, name: "Probuild" },
  });

  await prisma.tenantProfile.upsert({
    where: { tenantId: TENANT_ID },
    update: {},
    create: {
      tenantId: TENANT_ID,
      legalName: "Probuild",
    },
  });

  for (const account of ledgerAccounts) {
    await prisma.ledgerAccount.upsert({
      where: {
        tenantId_name: {
          tenantId: TENANT_ID,
          name: account.name,
        },
      },
      update: {
        type: account.type,
        group: account.group ?? null,
      },
      create: {
        tenantId: TENANT_ID,
        name: account.name,
        type: account.type,
        group: account.group ?? null,
      },
    });
  }

  for (const account of financeAccounts) {
    await prisma.financeAccount.upsert({
      where: {
        tenantId_name: {
          tenantId: TENANT_ID,
          name: account.name,
        },
      },
      update: { type: account.type },
      create: {
        tenantId: TENANT_ID,
        name: account.name,
        type: account.type,
      },
    });
  }

  for (const cat of txnCategories) {
    await prisma.txnCategory.upsert({
      where: {
        tenantId_direction_name: {
          tenantId: TENANT_ID,
          direction: cat.direction,
          name: cat.name,
        },
      },
      update: {},
      create: {
        tenantId: TENANT_ID,
        name: cat.name,
        direction: cat.direction,
      },
    });
  }

  // Minimal demo data (idempotent)
  const client =
    (await prisma.client.findFirst({
      where: { tenantId: TENANT_ID, name: "Demo Client" },
      select: { id: true },
    })) ??
    (await prisma.client.create({
      data: {
        tenantId: TENANT_ID,
        name: "Demo Client",
        contactPerson: "Client Contact",
        phone: "9999999999",
        billingAddress: "Bangalore, Karnataka",
      },
      select: { id: true },
    }));

  const vendor =
    (await prisma.vendor.findFirst({
      where: { tenantId: TENANT_ID, name: "Demo Vendor" },
      select: { id: true },
    })) ??
    (await prisma.vendor.create({
      data: {
        tenantId: TENANT_ID,
        name: "Demo Vendor",
        trade: "materials",
        isSubcontractor: false,
      },
      select: { id: true },
    }));

  const project =
    (await prisma.project.findFirst({
      where: { tenantId: TENANT_ID, name: "Demo Project" },
      select: { id: true },
    })) ??
    (await prisma.project.create({
      data: {
        tenantId: TENANT_ID,
        name: "Demo Project",
        clientId: client.id,
        status: "ACTIVE",
        location: "Bangalore",
      },
      select: { id: true },
    }));

  const invoice = await prisma.invoice.upsert({
    where: {
      tenantId_projectId_invoiceNo: {
        tenantId: TENANT_ID,
        projectId: project.id,
        invoiceNo: "INV-0001",
      },
    },
    update: {},
    create: {
      tenantId: TENANT_ID,
      projectId: project.id,
      clientId: client.id,
      invoiceNo: "INV-0001",
      invoiceDate: new Date("2026-02-01T00:00:00Z"),
      dueDate: new Date("2026-02-15T00:00:00Z"),
      status: "ISSUED",
      serviceDescription: "Construction stage billing (demo)",
      sacCode: "9954",
      gstRate: 18,
      gstType: "INTRA",
      subtotal: 100000,
      cgst: 9000,
      sgst: 9000,
      igst: 0,
      total: 118000,
      tdsRate: 1,
      tdsAmountExpected: 1000,
    },
    select: { id: true },
  });

  const expense =
    (await prisma.expense.findFirst({
      where: { tenantId: TENANT_ID, projectId: project.id, vendorId: vendor.id, billNo: "BILL-0001" },
      select: { id: true },
    })) ??
    (await prisma.expense.create({
      data: {
        tenantId: TENANT_ID,
        projectId: project.id,
        vendorId: vendor.id,
        category: "MATERIAL",
        billNo: "BILL-0001",
        billDate: new Date("2026-02-05T00:00:00Z"),
        dueDate: new Date("2026-02-20T00:00:00Z"),
        subtotal: 50000,
        cgst: 4500,
        sgst: 4500,
        igst: 0,
        total: 59000,
        narration: "Steel purchase (demo)",
      },
      select: { id: true },
    }));

  const bank = await prisma.financeAccount.findFirst({
    where: { tenantId: TENANT_ID, name: "Bank" },
    select: { id: true },
  });

  if (bank) {
    // Incoming money transaction, allocated to invoice (with TDS).
    const inTxn =
      (await prisma.transaction.findFirst({
        where: { tenantId: TENANT_ID, reference: "SEED-IN-0001" },
        select: { id: true },
      })) ??
      (await prisma.transaction.create({
        data: {
          tenantId: TENANT_ID,
          direction: "IN",
          date: new Date("2026-02-10T00:00:00Z"),
          amount: 47000,
          tdsAmount: 3000,
          mode: "BANK_TRANSFER",
          reference: "SEED-IN-0001",
          toAccountId: bank.id,
          projectId: project.id,
          clientId: client.id,
          note: "Seed receipt (demo)",
        },
        select: { id: true },
      }));

    await prisma.allocation.deleteMany({
      where: { tenantId: TENANT_ID, transactionId: inTxn.id, invoiceId: invoice.id },
    });
    await prisma.allocation.create({
      data: {
        tenantId: TENANT_ID,
        transactionId: inTxn.id,
        invoiceId: invoice.id,
        cashAmount: 47000,
        tdsAmount: 3000,
      },
    });

    // Outgoing money transaction, allocated to expense.
    const outTxn =
      (await prisma.transaction.findFirst({
        where: { tenantId: TENANT_ID, reference: "SEED-OUT-0001" },
        select: { id: true },
      })) ??
      (await prisma.transaction.create({
        data: {
          tenantId: TENANT_ID,
          direction: "OUT",
          date: new Date("2026-02-12T00:00:00Z"),
          amount: 20000,
          tdsAmount: 500,
          mode: "BANK_TRANSFER",
          reference: "SEED-OUT-0001",
          fromAccountId: bank.id,
          projectId: project.id,
          vendorId: vendor.id,
          note: "Seed payment (demo)",
        },
        select: { id: true },
      }));

    await prisma.allocation.deleteMany({
      where: { tenantId: TENANT_ID, transactionId: outTxn.id, expenseId: expense.id },
    });
    await prisma.allocation.create({
      data: {
        tenantId: TENANT_ID,
        transactionId: outTxn.id,
        expenseId: expense.id,
        cashAmount: 20000,
        tdsAmount: 500,
      },
    });
  }

  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  const adminName = process.env.SEED_ADMIN_NAME ?? "Admin";

  if (adminEmail && adminPassword) {
    const passwordHash = await hash(adminPassword, 12);
    await prisma.user.upsert({
      where: { email: adminEmail },
      update: {
        name: adminName,
        role: UserRole.ADMIN,
        passwordHash,
      },
      create: {
        tenantId: TENANT_ID,
        name: adminName,
        email: adminEmail,
        role: UserRole.ADMIN,
        passwordHash,
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
