import Link from "next/link";
import { getServerSession } from "next-auth/next";

import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatINR } from "@/lib/money";
import { getSelectedProjectId } from "@/lib/project-filter";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

export default async function WagesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const projectId = await getSelectedProjectId();
  const sheets = await prisma.labourSheet.findMany({
    where: { tenantId: session.user.tenantId, ...(projectId ? { projectId } : {}) },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 200,
    select: {
      id: true,
      date: true,
      total: true,
      mode: true,
      reference: true,
      project: { select: { id: true, name: true } },
    },
  });

  // Avoid Prisma relation `_count` (can generate database-specific aggregate queries).
  const sheetIds = sheets.map((s) => s.id);
  const lineCountBySheetId = new Map<string, number>();
  if (sheetIds.length > 0) {
    const lines = await prisma.labourSheetLine.findMany({
      where: { tenantId: session.user.tenantId, labourSheetId: { in: sheetIds } },
      select: { labourSheetId: true },
    });
    for (const l of lines) {
      lineCountBySheetId.set(l.labourSheetId, (lineCountBySheetId.get(l.labourSheetId) ?? 0) + 1);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <PageHeader
        title="Wages"
        description="Direct labour wage sheets (no 194C TDS)."
        action={{ label: "New labour sheet", href: "/app/wages/new" }}
      />

      <Card>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="hidden md:table-cell">Mode</TableHead>
                  <TableHead className="hidden md:table-cell">Reference</TableHead>
                  <TableHead className="hidden md:table-cell text-right">Lines</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sheets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                      No wage sheets yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  sheets.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>{s.date.toISOString().slice(0, 10)}</TableCell>
                      <TableCell className="max-w-[360px] truncate font-medium">
                        <Link className="hover:underline" href={`/app/wages/${s.id}`}>
                          {s.project.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right">{formatINR(Number(s.total))}</TableCell>
                      <TableCell className="hidden md:table-cell">{s.mode}</TableCell>
                      <TableCell className="hidden max-w-[260px] truncate md:table-cell">{s.reference ?? "-"}</TableCell>
                      <TableCell className="hidden md:table-cell text-right">{lineCountBySheetId.get(s.id) ?? 0}</TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="secondary">
                          <Link href={`/app/wages/${s.id}`}>View</Link>
                        </Button>
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
  );
}
