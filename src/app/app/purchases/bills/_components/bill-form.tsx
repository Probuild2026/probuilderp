"use client";

import { useEffect, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { createPurchaseInvoice, updatePurchaseInvoice } from "@/app/actions/purchase-invoices";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const billSchema = z
  .object({
    vendorId: z.string().min(1, "Vendor is required"),
    projectId: z.string().min(1, "Project is required"),
    invoiceDate: z.string().min(1, "Bill date is required"),
    invoiceNumber: z.string().min(1, "Bill number is required").max(50),
    gstType: z.enum(["INTRA", "INTER"]),
    taxableValue: z.coerce.number().min(0, "Taxable value must be >= 0"),
    cgst: z.coerce.number().min(0, "CGST cannot be negative").optional(),
    sgst: z.coerce.number().min(0, "SGST cannot be negative").optional(),
    igst: z.coerce.number().min(0, "IGST cannot be negative").optional(),
    total: z.coerce.number().min(0, "Total must be >= 0"),
  })
  .strict();

export type BillFormValues = z.infer<typeof billSchema>;

type BillFormProps = {
  mode: "create" | "edit";
  initialValues?: Partial<BillFormValues>;
  invoiceId?: string;
  vendors: { id: string; name: string }[];
  projects: { id: string; name: string }[];
  onSuccess?: () => void;
};

export function BillForm(props: BillFormProps) {
  const { mode, initialValues, invoiceId, vendors, projects, onSuccess } = props;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const defaultVendorId = initialValues?.vendorId ?? vendors[0]?.id ?? "";
  const defaultProjectId = initialValues?.projectId ?? projects[0]?.id ?? "";

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const form = useForm<BillFormValues>({
    // zodResolver (zod v4) types `z.coerce.number()` as `unknown` in the resolver output.
    // Runtime validation is correct; cast keeps TS happy.
    resolver: zodResolver(billSchema) as any,
    defaultValues: {
      vendorId: defaultVendorId,
      projectId: defaultProjectId,
      invoiceDate: initialValues?.invoiceDate ?? today,
      invoiceNumber: initialValues?.invoiceNumber ?? "",
      gstType: initialValues?.gstType ?? "INTRA",
      taxableValue: initialValues?.taxableValue ?? 0,
      cgst: initialValues?.cgst ?? 0,
      sgst: initialValues?.sgst ?? 0,
      igst: initialValues?.igst ?? 0,
      total: initialValues?.total ?? 0,
    },
  });

  useEffect(() => {
    if (!form.getValues("vendorId") && defaultVendorId) form.setValue("vendorId", defaultVendorId);
    if (!form.getValues("projectId") && defaultProjectId) form.setValue("projectId", defaultProjectId);
  }, [defaultProjectId, defaultVendorId, form]);

  const gstType = form.watch("gstType");
  const taxableValue = form.watch("taxableValue");
  const cgst = form.watch("cgst");
  const sgst = form.watch("sgst");
  const igst = form.watch("igst");

  useEffect(() => {
    const safeTaxable = Number.isFinite(taxableValue) ? taxableValue : 0;
    const safeCgst = Number.isFinite(cgst ?? 0) ? (cgst ?? 0) : 0;
    const safeSgst = Number.isFinite(sgst ?? 0) ? (sgst ?? 0) : 0;
    const safeIgst = Number.isFinite(igst ?? 0) ? (igst ?? 0) : 0;
    const nextTotal = safeTaxable + safeCgst + safeSgst + safeIgst;
    form.setValue("total", Number(nextTotal.toFixed(2)), { shouldValidate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taxableValue, cgst, sgst, igst, form.setValue]);

  function handleSubmit(values: BillFormValues) {
    startTransition(async () => {
      const payload = {
        ...values,
        cgst: values.gstType === "INTRA" ? values.cgst ?? 0 : 0,
        sgst: values.gstType === "INTRA" ? values.sgst ?? 0 : 0,
        igst: values.gstType === "INTER" ? values.igst ?? 0 : 0,
      };

      try {
        const res =
          mode === "create"
            ? await createPurchaseInvoice(payload)
            : invoiceId
              ? await updatePurchaseInvoice({ ...payload, id: invoiceId })
              : { ok: false as const, error: { code: "VALIDATION" as const, message: "Missing invoice id." } };

        if (!res.ok) {
          toast.error(res.error.message);
          return;
        }

        toast.success(mode === "create" ? "Bill saved." : "Bill updated.");
        if (onSuccess) {
          onSuccess();
          return;
        }
        if (mode === "create") router.push("/app/purchases/bills");
        if (mode === "edit" && invoiceId) router.push(`/app/purchases/bills/${invoiceId}`);
        router.refresh();
      } catch (error) {
        console.error(error);
        toast.error("Failed to save bill.");
      }
    });
  }

  const disabled = vendors.length === 0 || projects.length === 0;

  return (
    <Form {...form}>
      <form className="space-y-6" onSubmit={form.handleSubmit(handleSubmit)}>
        {disabled ? (
          <div className="rounded-md border p-4 text-sm text-muted-foreground">
            Add at least one {vendors.length === 0 ? "vendor" : "project"} first.
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="vendorId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Vendor</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select vendor" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {vendors.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name}
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
            name="projectId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Project</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
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
            name="invoiceDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Bill date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="invoiceNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Bill no / Reference</FormLabel>
                <FormControl>
                  <Input placeholder="Supplier invoice no." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="gstType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>GST type</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select GST type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="INTRA">Intra (CGST+SGST)</SelectItem>
                    <SelectItem value="INTER">Inter (IGST)</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="taxableValue"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Taxable value</FormLabel>
                <FormControl>
                  <Input type="number" inputMode="decimal" step="0.01" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {gstType === "INTRA" ? (
            <>
              <FormField
                control={form.control}
                name="cgst"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CGST</FormLabel>
                    <FormControl>
                      <Input type="number" inputMode="decimal" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sgst"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SGST</FormLabel>
                    <FormControl>
                      <Input type="number" inputMode="decimal" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          ) : (
            <FormField
              control={form.control}
              name="igst"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>IGST</FormLabel>
                  <FormControl>
                    <Input type="number" inputMode="decimal" step="0.01" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          <FormField
            control={form.control}
            name="total"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Total</FormLabel>
                <FormControl>
                  <Input type="number" inputMode="decimal" step="0.01" {...field} readOnly />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={isPending || disabled}>
            {mode === "create" ? (isPending ? "Saving…" : "Save bill") : isPending ? "Saving…" : "Update bill"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
