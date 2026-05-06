"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { stockMovementCreateSchema, type StockMovementCreateInput } from "@/lib/validators/stock";

import { createStockMovement } from "./actions";

type Option = { id: string; name: string };

async function showProjectInInventory(projectId: string) {
  try {
    const res = await fetch("/api/ui/project", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectId }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function NewMovementDialog({
  projects,
  items,
  selectedProjectId,
}: {
  projects: Option[];
  items: Option[];
  selectedProjectId?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const selectedProject = selectedProjectId ? projects.find((project) => project.id === selectedProjectId) : undefined;
  const defaultProjectId = selectedProject?.id ?? projects[0]?.id ?? "";

  const form = useForm<StockMovementCreateInput>({
    resolver: zodResolver(stockMovementCreateSchema),
    defaultValues: {
      projectId: defaultProjectId,
      itemId: items[0]?.id ?? "",
      date: today,
      direction: "IN",
      quantity: 1,
      unitCost: undefined,
      remarks: "",
    },
  });

  useEffect(() => {
    if (defaultProjectId) {
      form.setValue("projectId", defaultProjectId, { shouldDirty: false });
    }
  }, [defaultProjectId, form]);

  function onSubmit(values: StockMovementCreateInput) {
    startTransition(async () => {
      try {
        await createStockMovement(values);
        const projectIsVisible = values.projectId === selectedProjectId || (await showProjectInInventory(values.projectId));
        toast.success(projectIsVisible ? "Stock movement saved." : "Stock movement saved. Switch to its project to see it.");
        router.refresh();
        setOpen(false);
        form.reset({
          ...values,
          projectId: defaultProjectId || values.projectId,
          quantity: 1,
          unitCost: undefined,
          remarks: "",
        });
      } catch (e) {
        toast.error("Failed to save stock movement.");
        console.error(e);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Add Stock Movement</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Stock Movement (Adjustment)</DialogTitle>
          <DialogDescription>
            Use this for opening stock, corrections, or manual issues/receipts until purchase flows are wired.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="projectId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select project" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {projects.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="itemId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Item</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select item" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {items.map((i) => (
                          <SelectItem key={i.id} value={i.id}>
                            {i.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="direction"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Direction</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="In/Out" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="IN">IN</SelectItem>
                        <SelectItem value="OUT">OUT</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        inputMode="decimal"
                        step="0.001"
                        value={(field.value ?? "") as string | number | readonly string[] | undefined}
                        onChange={(e) => field.onChange(e.target.value)}
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="unitCost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit Cost (optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        value={(field.value ?? "") as string | number | readonly string[] | undefined}
                        onChange={(e) => field.onChange(e.target.value)}
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="remarks"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Remarks</FormLabel>
                  <FormControl>
                    <Input placeholder="Optional note" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
