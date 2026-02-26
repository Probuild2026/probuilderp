import { getServerSession } from "next-auth/next";

import { AddClientDialog } from "@/app/app/clients/client-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const q = typeof searchParams?.q === "string" ? searchParams.q : "";

  const clients = await prisma.client.findMany({
    where: {
      tenantId: session.user.tenantId,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { gstin: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Clients</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage client master data.</p>
        </div>
        <AddClientDialog />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>GSTIN</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients.map((client) => (
            <TableRow key={client.id}>
              <TableCell className="font-medium">{client.name}</TableCell>
              <TableCell>{client.contactPerson ?? "-"}</TableCell>
              <TableCell>{client.phone ?? "-"}</TableCell>
              <TableCell>{client.gstin ?? "-"}</TableCell>
            </TableRow>
          ))}
          {clients.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                No clients yet.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  );
}

