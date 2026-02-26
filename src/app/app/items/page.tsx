import { getServerSession } from "next-auth/next";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

import { DeleteItemButton } from "./delete-item-button";
import { ItemDialog } from "./item-dialog";

export default async function ItemsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const sp = (await searchParams) ?? {};
  const q = typeof sp.q === "string" ? sp.q : "";
  const type = typeof sp.type === "string" ? sp.type : "";

  const items = await prisma.item.findMany({
    where: {
      tenantId: session.user.tenantId,
      ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
      ...(type ? { type: type as never } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Items / Services</h1>
          <p className="mt-1 text-sm text-muted-foreground">Materials and services used in purchases and costing.</p>
        </div>
        <ItemDialog triggerLabel="Add Item" />
      </div>

      <form className="flex flex-wrap gap-3" action="/app/items" method="get">
        <Input name="q" placeholder="Search item name..." defaultValue={q} className="max-w-sm" />
        <select name="type" defaultValue={type} className="h-10 rounded-md border bg-background px-3 text-sm">
          <option value="">All types</option>
          <option value="MATERIAL">Material</option>
          <option value="SERVICE">Service</option>
        </select>
        <button className="h-10 rounded-md bg-primary px-4 text-sm text-primary-foreground" type="submit">
          Apply
        </button>
        <a className="h-10 rounded-md border px-4 text-sm leading-10" href="/app/items">
          Reset
        </a>
      </form>

      <div className="overflow-x-auto rounded-md border">
        <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Unit</TableHead>
            <TableHead>SAC/HSN</TableHead>
            <TableHead>GST %</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((i) => (
            <TableRow key={i.id}>
              <TableCell className="font-medium">{i.name}</TableCell>
              <TableCell>
                <Badge variant={i.type === "MATERIAL" ? "default" : "secondary"}>
                  {i.type === "MATERIAL" ? "Material" : "Service"}
                </Badge>
              </TableCell>
              <TableCell>{i.unit ?? "-"}</TableCell>
              <TableCell>{i.sacHsnCode ?? "-"}</TableCell>
              <TableCell>{i.gstRate.toString()}</TableCell>
              <TableCell className="text-right">
                <div className="inline-flex items-center gap-2">
                  <ItemDialog
                    triggerLabel="Edit"
                    initial={{
                      id: i.id,
                      name: i.name,
                      type: i.type,
                      unit: i.unit ?? "",
                      sacHsnCode: i.sacHsnCode ?? "",
                      gstRate: i.gstRate.toString(),
                    }}
                  />
                  <DeleteItemButton id={i.id} />
                </div>
              </TableCell>
            </TableRow>
          ))}
          {items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                No items yet.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
        </Table>
      </div>
    </div>
  );
}
