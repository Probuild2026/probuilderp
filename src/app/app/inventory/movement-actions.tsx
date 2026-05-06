"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

import { deleteStockMovement, updateStockMovement } from "./actions";

type Option = { id: string; name: string; unit?: string | null };
type Movement = {
  id: string;
  projectId: string;
  itemId: string;
  date: string;
  direction: "IN" | "OUT";
  quantity: string;
  unitCost: string;
  stageName: string;
  remarks: string;
  locked: boolean;
};

function formPayload(form: HTMLFormElement) {
  return Object.fromEntries(new FormData(form).entries());
}

export function MovementActions({
  movement,
  projects,
  items,
}: {
  movement: Movement;
  projects: Option[];
  items: Option[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  if (movement.locked) {
    return <span className="text-xs text-muted-foreground">Use delivery</span>;
  }

  return (
    <div className="inline-flex items-center justify-end gap-2">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline">Edit</Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit stock movement</DialogTitle>
            <DialogDescription>Manual stock movements can be edited here. Delivery movements are edited from Material tracking.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget;
              startTransition(async () => {
                try {
                  await updateStockMovement({ id: movement.id, ...formPayload(form) });
                  toast.success("Stock movement updated.");
                  setOpen(false);
                  router.refresh();
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Failed to update stock movement.");
                }
              });
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm">
                <div className="font-medium text-muted-foreground">Project</div>
                <select name="projectId" defaultValue={movement.projectId} className="h-10 w-full rounded-md border bg-background px-3 text-sm" required>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>{project.name}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm">
                <div className="font-medium text-muted-foreground">Item</div>
                <select name="itemId" defaultValue={movement.itemId} className="h-10 w-full rounded-md border bg-background px-3 text-sm" required>
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                      {item.unit ? ` (${item.unit})` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm">
                <div className="font-medium text-muted-foreground">Date</div>
                <Input name="date" type="date" defaultValue={movement.date} required />
              </label>
              <label className="space-y-2 text-sm">
                <div className="font-medium text-muted-foreground">Direction</div>
                <select name="direction" defaultValue={movement.direction} className="h-10 w-full rounded-md border bg-background px-3 text-sm" required>
                  <option value="IN">IN</option>
                  <option value="OUT">OUT</option>
                </select>
              </label>
              <label className="space-y-2 text-sm">
                <div className="font-medium text-muted-foreground">Quantity</div>
                <Input name="quantity" type="number" inputMode="decimal" step="0.001" defaultValue={movement.quantity} required />
              </label>
              <label className="space-y-2 text-sm">
                <div className="font-medium text-muted-foreground">Unit cost</div>
                <Input name="unitCost" type="number" inputMode="decimal" step="0.01" defaultValue={movement.unitCost} />
              </label>
            </div>
            <label className="space-y-2 text-sm">
              <div className="font-medium text-muted-foreground">Stage / area</div>
              <Input name="stageName" defaultValue={movement.stageName} />
            </label>
            <label className="space-y-2 text-sm">
              <div className="font-medium text-muted-foreground">Remarks</div>
              <Input name="remarks" defaultValue={movement.remarks} />
            </label>
            <div className="flex justify-end">
              <Button type="submit" disabled={pending}>{pending ? "Saving..." : "Save"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <Button
        size="sm"
        variant="destructive"
        disabled={pending}
        onClick={() => {
          if (!confirm("Delete this stock movement?")) return;
          startTransition(async () => {
            try {
              await deleteStockMovement({ id: movement.id });
              toast.success("Stock movement deleted.");
              router.refresh();
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "Failed to delete stock movement.");
            }
          });
        }}
      >
        Delete
      </Button>
    </div>
  );
}
