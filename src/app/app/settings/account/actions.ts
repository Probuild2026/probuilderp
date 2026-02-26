"use server";

import { compare, hash } from "bcryptjs";
import { getServerSession } from "next-auth/next";

import { changeEmailSchema, changePasswordSchema } from "@/lib/validators/account";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

export async function changeEmail(input: unknown) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const parsed = changeEmailSchema.parse(input);

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user?.passwordHash) throw new Error("Password login is not enabled for this user.");

  const ok = await compare(parsed.currentPassword, user.passwordHash);
  if (!ok) throw new Error("Invalid current password.");

  await prisma.user.update({
    where: { id: user.id },
    data: { email: parsed.newEmail },
  });
}

export async function changePassword(input: unknown) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const parsed = changePasswordSchema.parse(input);

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user?.passwordHash) throw new Error("Password login is not enabled for this user.");

  const ok = await compare(parsed.currentPassword, user.passwordHash);
  if (!ok) throw new Error("Invalid current password.");

  const passwordHash = await hash(parsed.newPassword, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });
}

