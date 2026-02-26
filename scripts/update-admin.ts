import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const currentEmail = process.env.CURRENT_ADMIN_EMAIL ?? "admin@local";
    const newEmail = requiredEnv("NEW_ADMIN_EMAIL");
    const newPassword = process.env.NEW_ADMIN_PASSWORD;
    const newName = process.env.NEW_ADMIN_NAME;

    const user = await prisma.user.findUnique({ where: { email: currentEmail } });
    if (!user) throw new Error(`No user found with CURRENT_ADMIN_EMAIL=${currentEmail}`);

    if (newEmail !== currentEmail) {
      const existing = await prisma.user.findUnique({ where: { email: newEmail } });
      if (existing) throw new Error(`A user already exists with NEW_ADMIN_EMAIL=${newEmail}`);
    }

    const data: { email?: string; passwordHash?: string; name?: string } = { email: newEmail };
    if (typeof newName === "string" && newName.trim().length) data.name = newName.trim();
    if (typeof newPassword === "string" && newPassword.length) {
      data.passwordHash = await hash(newPassword, 12);
    }

    await prisma.user.update({ where: { id: user.id }, data });

    console.log(
      `Updated admin user ${user.id}: email=${newEmail}${newPassword ? " (password updated)" : ""}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
