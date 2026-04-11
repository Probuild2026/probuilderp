import { getServerSession } from "next-auth/next";
import { Prisma } from "@prisma/client";
import { Boxes, Package, Wrench } from "lucide-react";

import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

import { DeleteItemButton } from "./delete-item-button";
import { ItemDialog } from "./item-dialog";

function isMissingTableError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2021" || error.code === "P2022");
}

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

  try {
    const items = await prisma.item.findMany({
      where: {
        tenantId: session.user.tenantId,
        ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
        ...(type ? { type: type as never } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const totals = items.reduce(
      (acc, item) => {
        acc.total += 1;
        if (item.type === "MATERIAL") acc.material += 1;
        if (item.type === "SERVICE") acc.service += 1;
        if (item.type === "LABOUR") acc.labour += 1;
        return acc;
      },
      { total: 0, material: 0, service: 0, labour: 0 },
    );

    return (
      <div className="mx-auto max-w-[1440px] space-y-6 p-4 md:p-6">
        <PageHeader
          eyebrow="Admin / Items"
          title="Items and services"
          description="Keep purchasing, costing, and inventory codes consistent by managing one clean catalog of materials, labour, and services."
          actions={<ItemDialog triggerLabel="Add item" />}
          filters={
            <form className="flex flex-wrap gap-3" action="/app/items" method="get">
              <Input name="q" placeholder="Search item name..." defaultValue={q} className="max-w-sm" />
              <select name="type" defaultValue={type} className="h-10 rounded-xl border border-border/80 bg-background/80 px-3 text-sm shadow-sm">
                <option value="">All types</option>
                <option value="MATERIAL">Material</option>
                <option value="LABOUR">Labour</option>
                <option value="SERVICE">Service</option>
              </select>
              <button className="h-10 rounded-xl bg-primary px-4 text-sm text-primary-foreground" type="submit">
                Apply
              </button>
              <a className="h-10 rounded-xl border border-border/80 px-4 text-sm leading-10" href="/app/items">
                Reset
              </a>
            </form>
          }
        />

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={Boxes} label="Catalog entries" value={String(totals.total)} />
          <MetricCard icon={Package} label="Materials" value={String(totals.material)} />
          <MetricCard icon={Wrench} label="Services" value={String(totals.service)} />
          <MetricCard icon={Boxes} label="Labour codes" value={String(totals.labour)} />
        </section>

        <Card>
          <CardHeader className="border-b border-border/60">
            <CardTitle className="text-base">Catalog</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>SAC / HSN</TableHead>
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
                        {i.type === "MATERIAL" ? "Material" : i.type === "LABOUR" ? "Labour" : "Service"}
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
          </CardContent>
        </Card>
      </div>
    );
  } catch (error) {
    if (!isMissingTableError(error)) throw error;
    return (
      <div className="mx-auto max-w-4xl space-y-4 p-4 md:p-6">
        <PageHeader eyebrow="Admin / Items" title="Items and services" description="Database update required for the item catalog." />
        <div className="rounded-[24px] border border-border/70 bg-card p-4 text-sm">
          <div className="font-medium">Run Prisma migration</div>
          <pre className="mt-3 overflow-x-auto rounded-xl bg-black/40 p-3 text-xs">
{`cd "/Users/roshanvinayan/Documents/Probuild ERP/probuild-erp"
npx prisma migrate deploy`}
          </pre>
        </div>
      </div>
    );
  }
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 pt-6">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
          <div className="mt-3 text-2xl font-semibold tracking-tight">{value}</div>
        </div>
        <div className="flex size-11 items-center justify-center rounded-2xl bg-accent/60 text-accent-foreground">
          <Icon className="size-4" />
        </div>
      </CardContent>
    </Card>
  );
}
