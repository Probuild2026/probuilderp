import { getServerSession } from "next-auth/next";

import { AddClientDialog } from "@/app/app/clients/client-dialog";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const sp = (await searchParams) ?? {};
  const q = typeof sp.q === "string" ? sp.q : "";

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
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <PageHeader
        title="Clients"
        description="Manage client master data."
        actions={<AddClientDialog />}
        filters={
          <form className="flex flex-col gap-3 sm:flex-row sm:items-end" action="/app/clients" method="get">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground">Search</label>
              <Input name="q" defaultValue={q} placeholder="Name / GSTIN" />
            </div>
            <div className="flex gap-2">
              <Button type="submit">Apply</Button>
              <Button type="button" variant="secondary" asChild>
                <a href="/app/clients">Reset</a>
              </Button>
            </div>
          </form>
        }
      />

      <div className="overflow-x-auto rounded-md border">
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
    </div>
  );
}
