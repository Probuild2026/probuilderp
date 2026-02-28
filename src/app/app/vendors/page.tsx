import { getServerSession } from "next-auth/next";

import { AddVendorDialog } from "@/app/app/vendors/vendor-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";
import { Prisma } from "@prisma/client";

export default async function VendorsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const sp = (await searchParams) ?? {};
  const q = typeof sp.q === "string" ? sp.q : "";
  const trade = typeof sp.trade === "string" ? sp.trade : "";
  const subcontractorsOnly = sp.subcontractors === "1";

  let vendors:
    | Array<{
        id: string;
        name: string;
        trade: string | null;
        gstin: string | null;
        isSubcontractor: boolean;
      }>
    | null = null;

  try {
    vendors = await prisma.vendor.findMany({
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
        ...(trade ? { trade: { equals: trade, mode: "insensitive" } } : {}),
        ...(subcontractorsOnly ? { isSubcontractor: true } : {}),
      },
      select: {
        id: true,
        name: true,
        trade: true,
        gstin: true,
        isSubcontractor: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  } catch (e) {
    // If the database hasn't been migrated yet, don't crash the whole page.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2022") {
      vendors = null;
    } else {
      throw e;
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Vendors</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Search, filter, and manage vendor master data.
          </p>
        </div>
        <AddVendorDialog />
      </div>

      {vendors === null ? (
        <div className="rounded-md border bg-muted/20 p-4 text-sm">
          <div className="font-medium">Database update required</div>
          <div className="mt-1 text-muted-foreground">
            Your app code was deployed, but the database migrations haven’t been applied yet. Run Prisma migrations, then refresh.
          </div>
          <pre className="mt-3 overflow-x-auto rounded-md bg-black/40 p-3 text-xs">
{`cd "/Users/roshanvinayan/Documents/Probuild ERP/probuild-erp"

# If you previously had a failed migration:
npx prisma migrate resolve --rolled-back 20260228145912_durable_backbone

npx prisma migrate deploy`}
          </pre>
        </div>
      ) : null}

      <form className="flex flex-col gap-3 sm:flex-row sm:items-end" action="/app/vendors" method="get">
        <div className="flex-1">
          <label className="text-xs text-muted-foreground">Search</label>
          <Input name="q" defaultValue={q} placeholder="Name / GSTIN" />
        </div>
        <div className="sm:w-56">
          <label className="text-xs text-muted-foreground">Trade</label>
          <Input name="trade" defaultValue={trade} placeholder="steel, cement..." />
        </div>
        <div className="flex items-center gap-2 rounded-md border px-3 py-2">
          <input
            className="size-4 accent-primary"
            type="checkbox"
            name="subcontractors"
            value="1"
            defaultChecked={subcontractorsOnly}
          />
          <span className="text-sm">Subcontractors only</span>
        </div>
        <div className="flex gap-2">
          <Button type="submit">Apply</Button>
          <Button type="button" variant="secondary" asChild>
            <a href="/app/vendors">Reset</a>
          </Button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-md border">
        <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Trade</TableHead>
            <TableHead>GSTIN</TableHead>
            <TableHead>Type</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(vendors ?? []).map((vendor) => (
            <TableRow key={vendor.id}>
              <TableCell className="font-medium">{vendor.name}</TableCell>
              <TableCell>{vendor.trade ?? "-"}</TableCell>
              <TableCell>{vendor.gstin ?? "-"}</TableCell>
              <TableCell>
                {vendor.isSubcontractor ? <Badge>Subcontractor</Badge> : <span className="text-muted-foreground">Vendor</span>}
              </TableCell>
            </TableRow>
          ))}
          {(vendors ?? []).length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                No vendors yet.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
        </Table>
      </div>
    </div>
  );
}
