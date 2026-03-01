"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { clientUpdateSchema } from "@/lib/validators/client";

import { updateClient } from "../actions";

type ClientUpdateFormValues = z.input<typeof clientUpdateSchema>;

export function ClientEditDialog({
  client,
}: {
  client: {
    id: string;
    name: string;
    contactPerson: string | null;
    phone: string | null;
    email: string | null;
    billingAddress: string | null;
    siteAddress: string | null;
    gstin: string | null;
    pan: string | null;
    paymentTermsDays: number | null;
    preferredPaymentMode: string | null;
    notes: string | null;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const defaultValues: ClientUpdateFormValues = useMemo(
    () => ({
      id: client.id,
      name: client.name ?? "",
      contactPerson: client.contactPerson ?? "",
      phone: client.phone ?? "",
      email: client.email ?? "",
      billingAddress: client.billingAddress ?? "",
      siteAddress: client.siteAddress ?? "",
      gstin: client.gstin ?? "",
      pan: client.pan ?? "",
      paymentTermsDays: client.paymentTermsDays ?? undefined,
      preferredPaymentMode: client.preferredPaymentMode ?? "",
      notes: client.notes ?? "",
    }),
    [client],
  );

  const form = useForm<ClientUpdateFormValues>({
    resolver: zodResolver(clientUpdateSchema),
    defaultValues,
  });

  function onSubmit(values: ClientUpdateFormValues) {
    startTransition(async () => {
      try {
        await updateClient(values);
        toast.success("Client updated.");
        setOpen(false);
        router.refresh();
      } catch (e) {
        toast.error("Failed to update client.");
        console.error(e);
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) form.reset(defaultValues);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">Edit client</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit client</DialogTitle>
          <DialogDescription>Update client master details.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Client name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contactPerson"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact person</FormLabel>
                    <FormControl>
                      <Input placeholder="Contact person" {...field} />
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

              <FormField
                control={form.control}
                name="paymentTermsDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment terms (days)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        inputMode="numeric"
                        step="1"
                        placeholder="e.g. 15"
                        name={field.name}
                        ref={field.ref}
                        disabled={field.disabled}
                        value={field.value == null || field.value === "" ? "" : String(field.value)}
                        onBlur={field.onBlur}
                        onChange={(e) => {
                          const v = e.target.value;
                          field.onChange(v === "" ? undefined : Number(v));
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="preferredPaymentMode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preferred payment mode</FormLabel>
                    <FormControl>
                      <Input placeholder="UPI / Bank transfer / Cash" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="gstin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>GSTIN</FormLabel>
                    <FormControl>
                      <Input placeholder="GSTIN" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="pan"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>PAN</FormLabel>
                    <FormControl>
                      <Input placeholder="PAN" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="billingAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Billing address</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Billing address" className="min-h-24" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="siteAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Site address</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Site address" className="min-h-24" {...field} />
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

            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
