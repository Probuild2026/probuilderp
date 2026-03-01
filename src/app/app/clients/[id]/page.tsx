import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";

import { deleteClientContact, setPrimaryClientContact } from "@/app/actions/client-contacts";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

import { ClientEditDialog } from "./client-edit-dialog";
import { ContactDialog } from "./contact-dialog";

function val(v: string | null | undefined) {
  return v?.trim() ? v : "—";
}

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const { id } = await params;

  const client = await prisma.client.findFirst({
    where: { tenantId: session.user.tenantId, id },
    select: {
      id: true,
      name: true,
      contactPerson: true,
      phone: true,
      email: true,
      billingAddress: true,
      siteAddress: true,
      gstin: true,
      pan: true,
      paymentTermsDays: true,
      preferredPaymentMode: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!client) return null;

  const contacts = await prisma.clientContact.findMany({
    where: { tenantId: session.user.tenantId, clientId: client.id },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      role: true,
      phone: true,
      whatsapp: true,
      email: true,
      isPrimary: true,
      notes: true,
      createdAt: true,
    },
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <PageHeader
        title={client.name}
        description="Client details, contacts and billing preferences."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/app/clients">Back</Link>
            </Button>
            <ClientEditDialog client={client} />
            <ContactDialog triggerLabel="Add contact" clientId={client.id} />
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Client info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <div className="text-xs text-muted-foreground">Contact person</div>
                <div className="mt-1 font-medium">{val(client.contactPerson)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Phone</div>
                <div className="mt-1 font-medium">{val(client.phone)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Email</div>
                <div className="mt-1 font-medium">{val(client.email)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Payment terms</div>
                <div className="mt-1 font-medium">{client.paymentTermsDays != null ? `${client.paymentTermsDays} days` : "—"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Preferred payment mode</div>
                <div className="mt-1 font-medium">{val(client.preferredPaymentMode)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">GSTIN</div>
                <div className="mt-1 font-medium">{val(client.gstin)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">PAN</div>
                <div className="mt-1 font-medium">{val(client.pan)}</div>
              </div>
            </div>

            <div>
              <div className="text-xs text-muted-foreground">Billing address</div>
              <div className="mt-1 whitespace-pre-wrap">{val(client.billingAddress)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Site address</div>
              <div className="mt-1 whitespace-pre-wrap">{val(client.siteAddress)}</div>
            </div>
            {client.notes?.trim() ? (
              <div>
                <div className="text-xs text-muted-foreground">Notes</div>
                <div className="mt-1 whitespace-pre-wrap">{client.notes}</div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contacts</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="hidden md:table-cell">Role</TableHead>
                    <TableHead className="hidden md:table-cell">Phone</TableHead>
                    <TableHead className="hidden lg:table-cell">Email</TableHead>
                    <TableHead className="w-[1%] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contacts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                        No contacts yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    contacts.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="min-w-0">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <div className="truncate font-medium">{c.name}</div>
                              {c.isPrimary ? <Badge variant="secondary">Primary</Badge> : null}
                            </div>
                            <div className="mt-0.5 truncate text-xs text-muted-foreground md:hidden">
                              {val(c.role)} • {val(c.phone)} • {val(c.email)}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">{val(c.role)}</TableCell>
                        <TableCell className="hidden md:table-cell">{val(c.phone)}</TableCell>
                        <TableCell className="hidden lg:table-cell">{val(c.email)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <ContactDialog
                              triggerLabel="Edit"
                              clientId={client.id}
                              initial={c}
                            />
                            <form
                              action={async () => {
                                "use server";
                                await setPrimaryClientContact({ id: c.id, clientId: client.id });
                              }}
                            >
                              <Button variant="outline" size="sm" type="submit" disabled={c.isPrimary}>
                                Primary
                              </Button>
                            </form>
                            <form
                              action={async () => {
                                "use server";
                                await deleteClientContact(c.id);
                              }}
                            >
                              <Button variant="destructive" size="sm" type="submit">
                                Delete
                              </Button>
                            </form>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

