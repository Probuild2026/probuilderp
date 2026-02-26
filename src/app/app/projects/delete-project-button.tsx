"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { deleteProject } from "./actions";

export function DeleteProjectButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="destructive"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (!confirm("Delete this project? This cannot be undone.")) return;
        startTransition(async () => {
          try {
            await deleteProject(id);
            toast.success("Project deleted.");
          } catch (e) {
            toast.error("Failed to delete project (it may be referenced).");
            console.error(e);
          }
        });
      }}
    >
      Delete
    </Button>
  );
}

