import Link from "next/link";
import { getServerSession } from "next-auth/next";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { authOptions } from "@/server/auth";

export default async function ImportsHomePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Imports</h1>
        <p className="mt-1 text-sm text-muted-foreground">Upload CSV files to create Bills, Payments Made, and more.</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Purchases</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/app/imports/purchases">Import Bills / Payments Made</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/app/purchases/bills">Bills</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/app/purchases/payments-made">Payments Made</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

