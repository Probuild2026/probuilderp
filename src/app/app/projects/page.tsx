import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { BarChart3, Building2, CircleDollarSign, Landmark } from "lucide-react";

import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

import { DeleteProjectButton } from "./delete-project-button";
import { ProjectDialog } from "./project-dialog";

const statusLabel: Record<string, string> = {
  PLANNED: "Planned",
  ACTIVE: "Active",
  ON_HOLD: "On hold",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

function formatINR(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

function pct(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((value / total) * 100)));
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const sp = (await searchParams) ?? {};
  const q = typeof sp.q === "string" ? sp.q : "";
  const status = typeof sp.status === "string" ? sp.status : "";
  const clientId = typeof sp.clientId === "string" ? sp.clientId : "";

  const clients = await prisma.client.findMany({
    where: { tenantId: session.user.tenantId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const projects = await prisma.project.findMany({
    where: {
      tenantId: session.user.tenantId,
      ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
      ...(status ? { status: status as never } : {}),
      ...(clientId ? { clientId } : {}),
    },
    include: {
      client: { select: { id: true, name: true } },
      clientInvoices: { select: { total: true } },
      purchaseInvoices: { select: { total: true } },
      expenses: { select: { totalAmount: true } },
      labourSheets: { select: { total: true } },
      paymentStages: {
        select: {
          expectedAmount: true,
          actualBank: true,
          actualCash: true,
        },
      },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 50,
  });

  const enriched = projects.map((project) => {
    const billed = project.clientInvoices.reduce((sum, row) => sum + Number(row.total), 0);
    const spent =
      project.purchaseInvoices.reduce((sum, row) => sum + Number(row.total), 0) +
      project.expenses.reduce((sum, row) => sum + Number(row.totalAmount), 0) +
      project.labourSheets.reduce((sum, row) => sum + Number(row.total), 0);
    const expected = project.paymentStages.reduce((sum, row) => sum + Number(row.expectedAmount), 0);
    const received = project.paymentStages.reduce((sum, row) => sum + Number(row.actualBank) + Number(row.actualCash), 0);
    return { ...project, billed, spent, expected, received };
  });

  const totals = enriched.reduce(
    (acc, project) => {
      acc.total += 1;
      if (project.status === "ACTIVE") acc.active += 1;
      acc.expected += project.expected;
      acc.received += project.received;
      acc.spent += project.spent;
      return acc;
    },
    { total: 0, active: 0, expected: 0, received: 0, spent: 0 },
  );

  return (
    <div className="mx-auto max-w-[1440px] space-y-6 p-4 md:p-6">
      <PageHeader
        eyebrow="Projects"
        title="Projects"
        description="Track site-level financial health, expected stage collections, and spend progression without dropping straight into the detailed schedule editor."
        actions={<ProjectDialog clients={clients} triggerLabel="Add project" />}
        filters={
          <form className="flex flex-wrap gap-3" action="/app/projects" method="get">
            <Input name="q" placeholder="Search project name..." defaultValue={q} className="max-w-sm" />
            <select
              name="status"
              defaultValue={status}
              className="h-10 rounded-xl border border-border/80 bg-background/80 px-3 text-sm shadow-sm"
            >
              <option value="">All statuses</option>
              {Object.entries(statusLabel).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select
              name="clientId"
              defaultValue={clientId}
              className="h-10 rounded-xl border border-border/80 bg-background/80 px-3 text-sm shadow-sm"
            >
              <option value="">All clients</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
            <button className="h-10 rounded-xl bg-primary px-4 text-sm text-primary-foreground" type="submit">
              Apply
            </button>
            <Link className="h-10 rounded-xl border border-border/80 px-4 text-sm leading-10" href="/app/projects">
              Reset
            </Link>
          </form>
        }
      />

      <section className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader className="border-b border-border/60">
            <CardTitle className="text-base">Portfolio summary</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 pt-6 md:grid-cols-2 xl:grid-cols-4">
            <SummaryTile icon={Building2} label="Projects" value={String(totals.total)} />
            <SummaryTile icon={BarChart3} label="Active sites" value={String(totals.active)} />
            <SummaryTile icon={Landmark} label="Expected collections" value={formatINR(totals.expected)} />
            <SummaryTile icon={CircleDollarSign} label="Spent to date" value={formatINR(totals.spent)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border/60">
            <CardTitle className="text-base">Current posture</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-6">
            <QueuePill label="Received vs expected" value={`${pct(totals.received, Math.max(totals.expected, 1))}%`} />
            <QueuePill label="Tracked spend" value={formatINR(totals.spent)} />
            <QueuePill label="Client filter" value={clientId ? "Applied" : "All clients"} />
          </CardContent>
        </Card>
      </section>

      <div className="grid gap-4">
        {enriched.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">No projects matched this view.</CardContent>
          </Card>
        ) : (
          enriched.map((project) => {
            const collectionPct = pct(project.received, Math.max(project.expected, project.billed, 1));
            const spendPct = pct(project.spent, Math.max(project.expected, project.billed, 1));

            return (
              <Card key={project.id}>
                <CardContent className="pt-6">
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/app/projects/${project.id}`} className="truncate text-lg font-semibold hover:underline">
                          {project.name}
                        </Link>
                        <Badge variant={project.status === "ACTIVE" ? "default" : "secondary"}>
                          {statusLabel[project.status] ?? project.status}
                        </Badge>
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">{project.client.name}</div>
                      <div className="mt-1 text-sm text-muted-foreground">{project.location ?? "No location set"}</div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                      <Stat label="Expected" value={formatINR(project.expected)} />
                      <Stat label="Received" value={formatINR(project.received)} />
                      <Stat label="Billed" value={formatINR(project.billed)} />
                      <Stat label="Spent" value={formatINR(project.spent)} />
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 lg:grid-cols-2">
                    <ProgressRail label="Collection progress" value={collectionPct} tint="bg-[var(--success)]" />
                    <ProgressRail label="Spend vs plan" value={spendPct} tint="bg-[var(--warning)]" />
                  </div>

                  <div className="mt-5 flex flex-wrap justify-end gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/app/projects/${project.id}`}>Open</Link>
                    </Button>
                    <ProjectDialog
                      clients={clients}
                      triggerLabel="Edit"
                      initial={{
                        id: project.id,
                        name: project.name,
                        clientId: project.clientId,
                        location: project.location ?? "",
                        status: project.status,
                        startDate: project.startDate ? project.startDate.toISOString().slice(0, 10) : "",
                        endDate: project.endDate ? project.endDate.toISOString().slice(0, 10) : "",
                        remarks: project.remarks ?? "",
                      }}
                    />
                    <DeleteProjectButton id={project.id} />
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

function SummaryTile({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[22px] border border-border/60 bg-background/70 px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <div className="mt-4 text-2xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}

function QueuePill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[18px] border border-border/60 bg-background/70 px-4 py-3">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className="mt-1 font-semibold">{value}</div>
    </div>
  );
}

function ProgressRail({ label, value, tint }: { label: string; value: number; tint: string }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-xs">
        <span className="font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
        <span className="font-semibold">{value}%</span>
      </div>
      <div className="h-2.5 rounded-full bg-muted">
        <div className={`h-full rounded-full ${tint}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
