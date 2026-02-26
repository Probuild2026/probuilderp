import Link from "next/link";
import { getServerSession } from "next-auth/next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Monthly Expense CSV</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Auditor-friendly export for a selected month.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/app">Back</Link>
        </Button>
      </div>

      <form className="flex flex-wrap items-end gap-3" action="/app/reports/monthly-expenses" method="get">
        <label className="space-y-2 text-sm">
          <div className="text-muted-foreground">Month</div>
          <Input type="month" name="month" defaultValue={month} />
        </label>
        <Button type="submit">Update</Button>
        <Button asChild variant="secondary">
          <a href={`/api/reports/expenses-csv?month=${encodeURIComponent(month)}`}>Download CSV</a>
        </Button>
      </form>

      <div className="rounded-md border p-4 text-sm text-muted-foreground">
        Includes: project, vendor/labour, GST split, payment mode, narration, bill count.
      </div>
    </div>
  );
}
