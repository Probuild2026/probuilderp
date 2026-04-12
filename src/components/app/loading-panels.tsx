import { Card, CardContent, CardHeader } from "@/components/ui/card";

function Pulse({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-xl bg-muted/70 ${className}`} />;
}

export function PageLoadingSkeleton({
  showFilters = true,
  tableColumns = 6,
  tableRows = 5,
}: {
  showFilters?: boolean;
  tableColumns?: number;
  tableRows?: number;
}) {
  return (
    <div className="mx-auto max-w-[1440px] space-y-6 p-4 md:p-6">
      <section className="rounded-[28px] border border-border/70 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--card)_92%,transparent),color-mix(in_srgb,var(--surface-muted)_55%,transparent))] px-5 py-5 md:px-6 md:py-6">
        <Pulse className="h-3 w-32" />
        <Pulse className="mt-4 h-9 w-64 max-w-full" />
        <Pulse className="mt-3 h-4 w-full max-w-3xl" />
        <div className="mt-5 flex flex-wrap gap-2">
          <Pulse className="h-10 w-28" />
          <Pulse className="h-10 w-24" />
          <Pulse className="h-10 w-32" />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader className="border-b border-border/60">
            <Pulse className="h-5 w-40" />
          </CardHeader>
          <CardContent className="grid gap-4 pt-6 sm:grid-cols-2 2xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="rounded-[22px] border border-border/60 bg-background/70 px-4 py-4">
                <Pulse className="h-3 w-24" />
                <Pulse className="mt-5 h-8 w-28" />
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="border-b border-border/60">
            <Pulse className="h-5 w-32" />
          </CardHeader>
          <CardContent className="space-y-3 pt-6">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="rounded-[18px] border border-border/60 bg-background/70 px-4 py-3">
                <Pulse className="h-4 w-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      {showFilters ? (
        <section className="rounded-[24px] border border-border/70 bg-card px-4 py-4">
          <div className="grid gap-3 md:grid-cols-4">
            <Pulse className="h-10 w-full" />
            <Pulse className="h-10 w-full" />
            <Pulse className="h-10 w-full" />
            <Pulse className="h-10 w-full" />
          </div>
        </section>
      ) : null}

      <Card>
        <CardHeader className="border-b border-border/60">
          <Pulse className="h-5 w-36" />
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-[920px] w-full">
              <thead>
                <tr className="border-b border-border/60">
                  {Array.from({ length: tableColumns }).map((_, index) => (
                    <th key={index} className="px-6 py-4">
                      <Pulse className="h-3 w-20" />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: tableRows }).map((_, row) => (
                  <tr key={row} className="border-b border-border/60">
                    {Array.from({ length: tableColumns }).map((__, col) => (
                      <td key={col} className="px-6 py-4">
                        <Pulse className="h-4 w-full" />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
