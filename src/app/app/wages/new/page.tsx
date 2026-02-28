import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";

import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

import { LabourSheetCreateForm } from "./wages-create-form";

export default async function NewWagesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const projects = await prisma.project.findMany({
    where: { tenantId: session.user.tenantId },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true },
    take: 200,
  });

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold">New Labour Sheet</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Daily wages for direct labour (no vendor, no 194C TDS). This creates a wage sheet + a cash/bank transaction.
        </p>
      </div>
      <LabourSheetCreateForm today={today} projects={projects} />
    </div>
  );
}

