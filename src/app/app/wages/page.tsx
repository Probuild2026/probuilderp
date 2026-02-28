import Link from "next/link";
import { getServerSession } from "next-auth/next";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatINR } from "@/lib/money";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

export default async function WagesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const sheets = await prisma.labourSheet.findMany({
    where: { tenantId: session.user.tenantId },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 200,
    select: {
      id: true,
      date: true,
      total: true,
      mode: true,
      reference: true,
      project: { select: { id: true, name: true } },
      _count: { select: { lines: true } },
    },
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Wages</h1>
          <p className="mt-1 text-sm text-muted-foreground">Direct labour wage sheets (no 194C TDS).</p>
        </div>
        <Button asChild>
          <Link href="/app/wages/new">New labour sheet</Link>
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Lines</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sheets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                      No wage sheets yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  sheets.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>{s.date.toISOString().slice(0, 10)}</TableCell>
                      <TableCell className="max-w-[360px] truncate font-medium">{s.project.name}</TableCell>
                      <TableCell className="text-right">{formatINR(Number(s.total))}</TableCell>
                      <TableCell>{s.mode}</TableCell>
                      <TableCell className="max-w-[260px] truncate">{s.reference ?? "-"}</TableCell>
                      <TableCell className="text-right">{s._count.lines}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

