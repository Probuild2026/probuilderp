import { getServerSession } from "next-auth/next";

import { AddVendorDialog } from "@/app/app/vendors/vendor-dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

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

  const vendors = await prisma.vendor.findMany({
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
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

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

      <div className="overflow-x-auto rounded-md border">
        <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Trade</TableHead>
            <TableHead>GSTIN</TableHead>
            <TableHead>Subcontractor</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {vendors.map((vendor) => (
            <TableRow key={vendor.id}>
              <TableCell className="font-medium">{vendor.name}</TableCell>
              <TableCell>{vendor.trade ?? "-"}</TableCell>
              <TableCell>{vendor.gstin ?? "-"}</TableCell>
              <TableCell>
                {vendor.isSubcontractor ? <Badge>Yes</Badge> : <span className="text-muted-foreground">No</span>}
              </TableCell>
            </TableRow>
          ))}
          {vendors.length === 0 ? (
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
