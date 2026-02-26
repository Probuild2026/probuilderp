"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useTransition } from "react";
import { useForm } from "react-hook-form";
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
import { itemTypeSchema, itemUpsertSchema, type ItemUpsertFormValues } from "@/lib/validators/item";

import { upsertItem } from "./actions";

type ItemType = (typeof itemTypeSchema)["options"][number];

const typeLabel: Record<ItemType, string> = {
  MATERIAL: "Material",
  SERVICE: "Service",
};

export function ItemDialog({
  initial,
  triggerLabel,
}: {
  initial?: Partial<ItemUpsertFormValues> & { id?: string };
  triggerLabel: string;
}) {
  const [pending, startTransition] = useTransition();

  const defaultValues: ItemUpsertFormValues = useMemo(
    () => ({
      id: initial?.id,
      name: initial?.name ?? "",
      type: (initial?.type as ItemType) ?? "MATERIAL",
      unit: initial?.unit ?? "",
      sacHsnCode: initial?.sacHsnCode ?? "",
      gstRate: (initial?.gstRate ?? 0) as unknown,
    }),
    [initial],
  );

  const form = useForm<ItemUpsertFormValues>({
    resolver: zodResolver(itemUpsertSchema),
    defaultValues,
  });

  function onSubmit(values: ItemUpsertFormValues) {
    startTransition(async () => {
      try {
        await upsertItem(values);
        toast.success(values.id ? "Item updated." : "Item created.");
      } catch (e) {
        toast.error("Failed to save item.");
        console.error(e);
      }
    });
  }

  const title = initial?.id ? "Edit Item/Service" : "Add Item/Service";

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant={initial?.id ? "outline" : "default"} size={initial?.id ? "sm" : "default"}>
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Used in purchases, expenses and inventory.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Item name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(typeLabel).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
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
                name="unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit</FormLabel>
                    <FormControl>
                      <Input placeholder="kg, bag, sqft, nos" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sacHsnCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SAC/HSN</FormLabel>
                    <FormControl>
                      <Input placeholder="SAC/HSN code" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="gstRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>GST %</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        placeholder="0"
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

            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
