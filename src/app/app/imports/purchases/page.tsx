import { getServerSession } from "next-auth/next";

import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";
import { ImportPurchasesClient } from "./import-client";

export default async function ImportPurchasesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const projects = await prisma.project.findMany({
    where: { tenantId: session.user.tenantId },
    orderBy: [{ createdAt: "desc" }],
    select: { id: true, name: true },
    take: 200,
  });

  return <ImportPurchasesClient projects={projects} />;
}

