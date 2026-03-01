"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type Opt = { id: string; name: string };

export function GlobalProjectFilter({
  projects,
  value,
}: {
  projects: Opt[];
  value?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="hidden text-muted-foreground sm:inline">Project</span>
      <select
        className="h-9 max-w-[220px] rounded-md border bg-background px-2 text-sm"
        value={value ?? ""}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value;
          startTransition(async () => {
            const res = await fetch("/api/ui/project", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ projectId: next || null }),
            });
            if (!res.ok) {
              toast.error("Failed to update project filter.");
              return;
            }
            router.refresh();
          });
        }}
      >
        <option value="">All projects</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      {pending ? <span className="text-xs text-muted-foreground">Updating…</span> : null}
    </label>
  );
}

