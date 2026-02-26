import Link from "next/link";
import { getServerSession } from "next-auth/next";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const q = typeof searchParams?.q === "string" ? searchParams.q : "";
  const status = typeof searchParams?.status === "string" ? searchParams.status : "";
  const clientId = typeof searchParams?.clientId === "string" ? searchParams.clientId : "";

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
    include: { client: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Projects</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sites/jobs for costing and reporting.</p>
        </div>
        <ProjectDialog clients={clients} triggerLabel="Add Project" />
      </div>

      <form className="flex flex-wrap gap-3" action="/app/projects" method="get">
        <Input name="q" placeholder="Search project name..." defaultValue={q} className="max-w-sm" />
        <select
          name="status"
          defaultValue={status}
          className="h-10 rounded-md border bg-background px-3 text-sm"
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
          className="h-10 rounded-md border bg-background px-3 text-sm"
        >
          <option value="">All clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button className="h-10 rounded-md bg-primary px-4 text-sm text-primary-foreground" type="submit">
          Apply
        </button>
        <Link className="h-10 rounded-md border px-4 text-sm leading-10" href="/app/projects">
          Reset
        </Link>
      </form>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Project</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Location</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {projects.map((p) => (
            <TableRow key={p.id}>
              <TableCell className="font-medium">{p.name}</TableCell>
              <TableCell>{p.client.name}</TableCell>
              <TableCell>
                <Badge variant={p.status === "ACTIVE" ? "default" : "secondary"}>{statusLabel[p.status] ?? p.status}</Badge>
              </TableCell>
              <TableCell>{p.location ?? "-"}</TableCell>
              <TableCell className="text-right">
                <div className="inline-flex items-center gap-2">
                  <ProjectDialog
                    clients={clients}
                    triggerLabel="Edit"
                    initial={{
                      id: p.id,
                      name: p.name,
                      clientId: p.clientId,
                      location: p.location ?? "",
                      status: p.status,
                      startDate: p.startDate ? p.startDate.toISOString().slice(0, 10) : "",
                      endDate: p.endDate ? p.endDate.toISOString().slice(0, 10) : "",
                      remarks: p.remarks ?? "",
                    }}
                  />
                  <DeleteProjectButton id={p.id} />
                </div>
              </TableCell>
            </TableRow>
          ))}
          {projects.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                No projects yet.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  );
}
