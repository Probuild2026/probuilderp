import Link from "next/link";
import { getServerSession } from "next-auth/next";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

import { NewMovementDialog } from "./new-movement-dialog";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const sp = (await searchParams) ?? {};
  const projectId = typeof sp.projectId === "string" ? sp.projectId : "";
  const q = typeof sp.q === "string" ? sp.q : "";

  const projects = await prisma.project.findMany({
    where: { tenantId: session.user.tenantId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const items = await prisma.item.findMany({
    where: {
      tenantId: session.user.tenantId,
      type: "MATERIAL",
      ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true, unit: true },
    take: 200,
  });

  const activeProjectId = projectId || projects[0]?.id || "";

  const movements = activeProjectId
    ? await prisma.stockMovement.groupBy({
        by: ["itemId", "direction"],
        where: { tenantId: session.user.tenantId, projectId: activeProjectId },
        _sum: { quantity: true },
      })
    : [];

  const qtyByItem = new Map<string, { inQty: number; outQty: number }>();
  for (const m of movements) {
    const entry = qtyByItem.get(m.itemId) ?? { inQty: 0, outQty: 0 };
    const sum = Number(m._sum.quantity?.toString() ?? 0);
    if (m.direction === "IN") entry.inQty += sum;
    else entry.outQty += sum;
    qtyByItem.set(m.itemId, entry);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Inventory (Project-wise)</h1>
          <p className="mt-1 text-sm text-muted-foreground">Material balances per project from stock movements.</p>
        </div>
        <NewMovementDialog projects={projects} items={items} />
      </div>

      <form className="flex flex-wrap gap-3" action="/app/inventory" method="get">
        <select
          name="projectId"
          defaultValue={activeProjectId}
          className="h-10 rounded-md border bg-background px-3 text-sm"
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <Input name="q" placeholder="Search material..." defaultValue={q} className="max-w-sm" />
        <button className="h-10 rounded-md bg-primary px-4 text-sm text-primary-foreground" type="submit">
          Apply
        </button>
        <Link className="h-10 rounded-md border px-4 text-sm leading-10" href="/app/inventory">
          Reset
        </Link>
      </form>

      {!activeProjectId ? (
        <div className="rounded-md border p-6 text-sm text-muted-foreground">Create a project first.</div>
      ) : null}

      {activeProjectId ? (
        <div className="overflow-x-auto rounded-md border">
          <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead className="text-right">IN</TableHead>
              <TableHead className="text-right">OUT</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((i) => {
              const qty = qtyByItem.get(i.id) ?? { inQty: 0, outQty: 0 };
              const balance = qty.inQty - qty.outQty;
              return (
                <TableRow key={i.id}>
                  <TableCell className="font-medium">{i.name}</TableCell>
                  <TableCell>{i.unit ?? "-"}</TableCell>
                  <TableCell className="text-right">{qty.inQty.toFixed(3)}</TableCell>
                  <TableCell className="text-right">{qty.outQty.toFixed(3)}</TableCell>
                  <TableCell className="text-right">{balance.toFixed(3)}</TableCell>
                  <TableCell>
                    {balance < 0 ? <Badge variant="destructive">Negative</Badge> : <Badge variant="secondary">OK</Badge>}
                  </TableCell>
                </TableRow>
              );
            })}
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  No materials found.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
          </Table>
        </div>
      ) : null}
    </div>
  );
}
