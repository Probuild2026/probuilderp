import Link from "next/link";
import { getServerSession } from "next-auth/next";

import { ExportLinks } from "@/components/app/export-links";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSelectedProjectId } from "@/lib/project-filter";
import { prisma } from "@/server/db";
import { authOptions } from "@/server/auth";

export default async function MonthlyExpensesReportPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const sp = (await searchParams) ?? {};
  const month =
    typeof sp.month === "string"
      ? sp.month
      : new Date().toISOString().slice(0, 7);

  const projectId = await getSelectedProjectId();
  const project = projectId
    ? await prisma.project.findFirst({
        where: { tenantId: session.user.tenantId, id: projectId },
        select: { name: true },
      })
    : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      <PageHeader
        title="Monthly Outflow Export"
        description="Auditor-friendly monthly outflow register across bills, expenses, wages, and payments made."
        actions={
          <>
            <ExportLinks hrefBase="/api/reports/expenses-csv" params={{ month }} />
            <Button asChild variant="outline">
              <Link href="/app">Back</Link>
            </Button>
          </>
        }
        filters={
          <div className="text-sm text-muted-foreground">
            Project scope: <span className="text-foreground">{project?.name ?? "All projects"}</span>
          </div>
        }
      />

      <form className="flex flex-wrap items-end gap-3" action="/app/reports/monthly-expenses" method="get">
        <label className="space-y-2 text-sm">
          <div className="text-muted-foreground">Month</div>
          <Input type="month" name="month" defaultValue={month} />
        </label>
        <Button type="submit">Update</Button>
      </form>

      <div className="rounded-md border p-4 text-sm text-muted-foreground">
        Includes: row type, project, party, tax split, totals, cash/TDS/gross, payment mode, reference, narration, and linked counts across bills, expenses, wages, and payments made.
      </div>
    </div>
  );
}
