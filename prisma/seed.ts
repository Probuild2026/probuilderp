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

async function main() {
  await prisma.tenant.upsert({
    where: { id: TENANT_ID },
    update: { name: "Probuild" },
    create: { id: TENANT_ID, name: "Probuild" },
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
