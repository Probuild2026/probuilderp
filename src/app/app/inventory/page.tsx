import Link from "next/link";
import { getServerSession } from "next-auth/next";

import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getSelectedProjectId } from "@/lib/project-filter";
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
  const q = typeof sp.q === "string" ? sp.q : "";
  const selectedProjectId = await getSelectedProjectId();

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

  const activeProjectId = selectedProjectId || "";
  const activeProject = projects.find((p) => p.id === activeProjectId) ?? null;

  const movements = activeProjectId
    ? await prisma.stockMovement.groupBy({
        by: ["itemId", "direction"],
        where: { tenantId: session.user.tenantId, projectId: activeProjectId },
        _sum: { quantity: true },
      })
    : [];
  const recentMovements = activeProjectId
    ? await prisma.stockMovement.findMany({
        where: { tenantId: session.user.tenantId, projectId: activeProjectId },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        take: 20,
        select: {
          id: true,
          date: true,
          direction: true,
          quantity: true,
          stageName: true,
          referenceType: true,
          remarks: true,
          item: { select: { name: true, unit: true } },
        },
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
      <PageHeader
        title="Inventory (Project-wise)"
        description="Material balances per project from stock movements."
        actions={<NewMovementDialog projects={projects} items={items} selectedProjectId={activeProjectId || undefined} />}
        filters={
          <form className="flex flex-wrap items-end gap-3" action="/app/inventory" method="get">
            <div className="text-sm text-muted-foreground">
              Project: <span className="text-foreground">{activeProject?.name ?? "Select a project from the top bar"}</span>
            </div>
            <Input name="q" placeholder="Search material..." defaultValue={q} className="max-w-sm" />
            <Button type="submit">Apply</Button>
            <Button type="button" variant="secondary" asChild>
              <Link href="/app/inventory">Reset</Link>
            </Button>
          </form>
        }
      />

      {!activeProjectId ? (
        <div className="rounded-md border p-6 text-sm text-muted-foreground">
          Select a project using the project filter in the top bar to view project-wise inventory.
        </div>
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

      {activeProjectId ? (
        <Card>
          <CardHeader className="border-b border-border/60">
            <CardTitle className="text-base">Recent stock movements</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Direction</TableHead>
                  <TableHead>Stage / area</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentMovements.map((movement) => (
                  <TableRow key={movement.id}>
                    <TableCell>{movement.date.toISOString().slice(0, 10)}</TableCell>
                    <TableCell className="font-medium">{movement.item.name}</TableCell>
                    <TableCell>
                      <Badge variant={movement.direction === "IN" ? "secondary" : "outline"}>{movement.direction}</Badge>
                    </TableCell>
                    <TableCell>{movement.stageName ?? "-"}</TableCell>
                    <TableCell>{movement.referenceType.replace(/_/g, " ")}</TableCell>
                    <TableCell className="text-right">
                      {Number(movement.quantity).toFixed(3)}
                      {movement.item.unit ? ` ${movement.item.unit}` : ""}
                    </TableCell>
                  </TableRow>
                ))}
                {recentMovements.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                      No stock movements yet.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
