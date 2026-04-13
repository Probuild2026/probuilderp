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
        eyebrow="Sales / Clients"
        title="Clients"
        description="Manage client master data with quick search and a cleaner operating list."
        actions={<AddClientDialog />}
        filters={
          <form className="flex flex-col gap-3 sm:flex-row sm:items-end" action="/app/clients" method="get">
            <div className="flex-1">
              <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Search</label>
              <Input name="q" defaultValue={q} placeholder="Name / GSTIN" />
            </div>
            <div className="flex gap-2">
              <Button type="submit">Apply</Button>
              <Button type="button" variant="secondary" asChild>
                <Link href="/app/clients">Reset</Link>
              </Button>
            </div>
          </form>
        }
      />

      <section className="rounded-[26px] border border-border/70 bg-card px-5 py-4 shadow-[0_18px_40px_-34px_rgba(91,124,191,0.16)]">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Results</div>
          <div className="font-semibold text-foreground">{clients.length}</div>
          <div className="text-muted-foreground">clients in current view</div>
          {q ? <div className="rounded-full border border-border/70 bg-accent/65 px-3 py-1.5 text-sm font-medium text-accent-foreground">Filtered by: {q}</div> : null}
        </div>
      </section>

      <div className="overflow-x-auto rounded-[26px] border border-border/70 bg-card shadow-[0_18px_40px_-34px_rgba(91,124,191,0.14)]">
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
                  <Link className="block truncate font-semibold text-foreground hover:text-primary hover:underline" href={`/app/clients/${client.id}`}>
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
                <Button asChild size="sm" variant="outline">
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
