import { getServerSession } from "next-auth/next";

import Link from "next/link";

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
            <TableHead className="hidden md:table-cell">Contact</TableHead>
            <TableHead className="hidden md:table-cell">Phone</TableHead>
            <TableHead className="hidden lg:table-cell">GSTIN</TableHead>
            <TableHead className="w-[1%] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients.map((client) => (
            <TableRow key={client.id}>
              <TableCell className="min-w-0">
                <div className="min-w-0">
                  <Link className="block truncate font-medium hover:underline" href={`/app/clients/${client.id}`}>
                    {client.name}
                  </Link>
                  <div className="mt-0.5 truncate text-xs text-muted-foreground md:hidden">
                    {(client.contactPerson ?? "—") + " • " + (client.phone ?? "—")}
                  </div>
                </div>
              </TableCell>
              <TableCell className="hidden md:table-cell">{client.contactPerson ?? "-"}</TableCell>
              <TableCell className="hidden md:table-cell">{client.phone ?? "-"}</TableCell>
              <TableCell className="hidden lg:table-cell">{client.gstin ?? "-"}</TableCell>
              <TableCell className="text-right">
                <Button asChild size="sm" variant="secondary">
                  <Link href={`/app/clients/${client.id}`}>View</Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {clients.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
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
