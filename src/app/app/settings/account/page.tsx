import { getServerSession } from "next-auth/next";

import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

import { AccountSettingsForm } from "./settings-form";

export default async function AccountSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, name: true, role: true },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Account</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Update email/password. You’ll be signed out after changes.
        </p>
      </div>

      <AccountSettingsForm user={user ?? null} />
    </div>
  );
}
