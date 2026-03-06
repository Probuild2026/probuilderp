"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";

import { createPartner, updatePartner } from "@/app/actions/partners";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const partnerSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  pan: z.string().trim().optional(),
  profitRatio: z.coerce.number().min(0).max(100),
  capitalContribution: z.coerce.number().min(0).optional(),
  isActive: z.boolean(),
  notes: z.string().trim().optional(),
});

type PartnerFormValues = z.infer<typeof partnerSchema>;

function normalize(values: PartnerFormValues) {
  return {
    ...values,
    pan: values.pan?.trim() || undefined,
    notes: values.notes?.trim() || undefined,
  };
}

export function AddPartnerDialog() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const form = useForm<PartnerFormValues>({
    resolver: zodResolver(partnerSchema) as any,
    defaultValues: {
      name: "",
      pan: "",
      profitRatio: 0,
      capitalContribution: undefined,
      isActive: true,
      notes: "",
    },
  });

  function onSubmit(values: PartnerFormValues) {
    startTransition(async () => {
      const res = await createPartner(normalize(values));
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("Partner created.");
      form.reset();
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Add Partner</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Partner</DialogTitle>
          <DialogDescription>Create partner profile for remuneration and drawings tracking.</DialogDescription>
        </DialogHeader>
        <PartnerForm form={form} pending={pending} onSubmit={onSubmit} submitLabel="Save partner" />
      </DialogContent>
    </Dialog>
  );
}

export function EditPartnerDialog({
  partner,
}: {
  partner: { id: string; name: string; pan: string | null; profitRatio: number; capitalContribution: number | null; isActive: boolean; notes: string | null };
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const form = useForm<PartnerFormValues>({
    resolver: zodResolver(partnerSchema) as any,
    defaultValues: {
      name: partner.name,
      pan: partner.pan ?? "",
      profitRatio: partner.profitRatio,
      capitalContribution: partner.capitalContribution ?? undefined,
      isActive: partner.isActive,
      notes: partner.notes ?? "",
    },
  });

  function onSubmit(values: PartnerFormValues) {
    startTransition(async () => {
      const res = await updatePartner({ id: partner.id, ...normalize(values) });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("Partner updated.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Partner</DialogTitle>
          <DialogDescription>Update partner profile and ratio.</DialogDescription>
        </DialogHeader>
        <PartnerForm form={form} pending={pending} onSubmit={onSubmit} submitLabel="Save changes" />
      </DialogContent>
    </Dialog>
  );
}

function PartnerForm({
  form,
  pending,
  onSubmit,
  submitLabel,
}: {
  form: ReturnType<typeof useForm<PartnerFormValues>>;
  pending: boolean;
  onSubmit: (values: PartnerFormValues) => void;
  submitLabel: string;
}) {
  return (
    <Form {...form}>
      <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="Partner name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="pan"
            render={({ field }) => (
              <FormItem>
                <FormLabel>PAN</FormLabel>
                <FormControl>
                  <Input placeholder="ABCDE1234F" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="profitRatio"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Profit ratio %</FormLabel>
                <FormControl>
                  <Input inputMode="decimal" placeholder="e.g. 50" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="capitalContribution"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Capital contribution</FormLabel>
                <FormControl>
                  <Input inputMode="decimal" placeholder="Optional" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="isActive"
            render={({ field }) => (
              <FormItem className="mt-7 flex items-center gap-2">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(!!v)} />
                </FormControl>
                <FormLabel className="m-0">Active</FormLabel>
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea rows={3} placeholder="Optional notes" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving..." : submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
}
