"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { createClientContact, updateClientContact } from "@/app/actions/client-contacts";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const contactSchema = z.object({
  id: z.string().optional(),
  clientId: z.string().min(1),
  name: z.string().min(1),
  role: z.string().optional(),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  email: z.string().optional(),
  isPrimary: z.boolean().optional(),
  notes: z.string().optional(),
});

type ContactFormValues = z.input<typeof contactSchema>;

export function ContactDialog({
  triggerLabel,
  clientId,
  initial,
}: {
  triggerLabel: string;
  clientId: string;
  initial?: {
    id: string;
    name: string;
    role: string | null;
    phone: string | null;
    whatsapp: string | null;
    email: string | null;
    isPrimary: boolean;
    notes: string | null;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const defaultValues: ContactFormValues = useMemo(
    () => ({
      id: initial?.id,
      clientId,
      name: initial?.name ?? "",
      role: initial?.role ?? "",
      phone: initial?.phone ?? "",
      whatsapp: initial?.whatsapp ?? "",
      email: initial?.email ?? "",
      isPrimary: initial?.isPrimary ?? false,
      notes: initial?.notes ?? "",
    }),
    [clientId, initial],
  );

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues,
  });

  function onSubmit(values: ContactFormValues) {
    startTransition(async () => {
      try {
        if (values.id) {
          const res = await updateClientContact(values);
          if (!res.ok) {
            if (res.error.code === "VALIDATION" && res.error.fieldErrors) {
              for (const [key, message] of Object.entries(res.error.fieldErrors)) {
                const msg = Array.isArray(message) ? message[0] : message;
                form.setError(key as keyof ContactFormValues, { type: "server", message: msg });
              }
            }
            toast.error(res.error.message);
            return;
          }
          toast.success("Contact updated.");
          setOpen(false);
          router.refresh();
        } else {
          const res = await createClientContact(values);
          if (!res.ok) {
            if (res.error.code === "VALIDATION" && res.error.fieldErrors) {
              for (const [key, message] of Object.entries(res.error.fieldErrors)) {
                const msg = Array.isArray(message) ? message[0] : message;
                form.setError(key as keyof ContactFormValues, { type: "server", message: msg });
              }
            }
            toast.error(res.error.message);
            return;
          }
          toast.success("Contact added.");
          setOpen(false);
          router.refresh();
        }
      } catch (e) {
        toast.error("Failed to save contact.");
        console.error(e);
      }
    });
  }

  const title = initial?.id ? "Edit contact" : "Add contact";

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) form.reset(defaultValues);
      }}
    >
      <DialogTrigger asChild>
        <Button variant={initial?.id ? "outline" : "default"} size={initial?.id ? "sm" : "default"}>
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Client contacts for faster follow-up and billing.</DialogDescription>
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
                    <Input placeholder="Contact name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <FormControl>
                      <Input placeholder="Owner / Architect / Accountant" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="Phone" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="whatsapp"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>WhatsApp</FormLabel>
                    <FormControl>
                      <Input placeholder="WhatsApp" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="Email" {...field} />
                    </FormControl>
                    <FormMessage />
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
                    <Textarea placeholder="Optional notes" className="min-h-20" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!form.watch("isPrimary")}
                  onChange={(e) => form.setValue("isPrimary", e.target.checked)}
                />
                Primary contact
              </label>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
