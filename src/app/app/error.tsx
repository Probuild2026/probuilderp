"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

function isDbConnectionError(message: string) {
  return (
    message.includes("Can't reach database server") ||
    message.includes("P1001") ||
    message.includes("ECONNREFUSED") ||
    message.includes("ETIMEDOUT")
  );
}

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  const msg = error?.message || "Unexpected error";
  const dbDown = isDbConnectionError(msg);

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <div className="rounded-lg border p-4">
        <div className="text-lg font-semibold">{dbDown ? "Database connection issue" : "Something went wrong"}</div>
        <div className="mt-1 text-sm text-muted-foreground">
          {dbDown
            ? "The app couldn’t reach the database from Vercel at the moment. This is usually an environment/database availability issue."
            : "A server error occurred while loading this page."}
        </div>

        {error.digest ? (
          <div className="mt-2 text-xs text-muted-foreground">
            Digest: <span className="font-mono">{error.digest}</span>
          </div>
        ) : null}
      </div>

      {dbDown ? (
        <div className="rounded-lg border p-4 text-sm">
          <div className="font-medium">What to check</div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            <li>Vercel → Project → Settings → Environment Variables: confirm `DATABASE_URL` is set for Production.</li>
            <li>Vercel → Storage: confirm your Prisma Postgres database is active/healthy.</li>
            <li>If you just changed schema: run `npx prisma migrate deploy` against the Vercel DB, then redeploy.</li>
          </ul>
        </div>
      ) : null}

      <div className="flex gap-2">
        <Button onClick={() => reset()}>Try again</Button>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Reload
        </Button>
      </div>
    </div>
  );
}

