"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { createPurchaseInvoice, updatePurchaseInvoice } from "@/app/actions/purchase-invoices";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { uploadBillToBlob } from "@/lib/blob-upload";

const attachmentSchema = z.object({
  url: z.string().url(),
  name: z.string().min(1),
  type: z.string().min(1),
  size: z.number().int().nonnegative(),
});

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
    attachments: z.array(attachmentSchema).optional(),
  })
  .strict();

export type BillFormValues = z.infer<typeof billSchema>;

type BillFormProps = {
  mode: "create" | "edit";
  tenantId: number;
  initialValues?: Partial<BillFormValues>;
  invoiceId?: string;
  vendors: { id: string; name: string }[];
  projects: { id: string; name: string }[];
  onSuccess?: () => void;
};

export function BillForm(props: BillFormProps) {
  const { mode, tenantId, initialValues, invoiceId, vendors, projects, onSuccess } = props;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [files, setFiles] = useState<File[]>([]);

  const defaultVendorId = initialValues?.vendorId ?? vendors[0]?.id ?? "";
  const defaultProjectId = initialValues?.projectId ?? projects[0]?.id ?? "";

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const form = useForm<BillFormValues>({
    // zodResolver (zod v4) types `z.coerce.number()` as `unknown` in the resolver output.
    // Runtime validation is correct; cast keeps TS happy.
    resolver: zodResolver(billSchema) as Resolver<BillFormValues>,
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
      try {
        const attachments = files.length
          ? await Promise.all(
              files.map(async (file) => {
                const blob = await uploadBillToBlob({
                  tenantId,
                  entityPath: "purchase-invoices/tmp",
                  file,
                });
                return {
                  url: blob.url,
                  name: file.name,
                  type: file.type || "application/octet-stream",
                  size: file.size,
                };
              }),
            )
          : undefined;

        const payload = {
          ...values,
          cgst: values.gstType === "INTRA" ? values.cgst ?? 0 : 0,
          sgst: values.gstType === "INTRA" ? values.sgst ?? 0 : 0,
          igst: values.gstType === "INTER" ? values.igst ?? 0 : 0,
          attachments,
        };

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
        toast.error(error instanceof Error ? error.message : "Failed to save bill.");
      }
    });
  }

  const disabled = vendors.length === 0 || projects.length === 0;

  return (
    <Form {...form}>
      <form className="space-y-8" onSubmit={form.handleSubmit(handleSubmit)}>
        {disabled ? (
          <div className="rounded-md border p-4 text-sm text-muted-foreground">
            Add at least one {vendors.length === 0 ? "vendor" : "project"} first.
          </div>
        ) : null}

        <div className="grid gap-5 xl:grid-cols-2">
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

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
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
              <FormItem className="xl:col-span-1">
                <FormLabel>Total</FormLabel>
                <FormControl>
                  <Input type="number" inputMode="decimal" step="0.01" {...field} readOnly />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px] xl:items-start">
          <div className="space-y-3">
            <div className="text-sm font-medium">Attachments</div>
            <Input
              type="file"
              multiple
              accept="image/*,application/pdf"
              onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
            />
            <div className="text-sm text-muted-foreground">
              Upload vendor invoice scans or PDFs now so the bill record keeps its source document attached.
            </div>
            {files.length > 0 ? (
              <div className="space-y-2 rounded-[20px] border border-border/60 bg-background/70 p-4">
                {files.map((file) => (
                  <div key={`${file.name}-${file.size}`} className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate font-medium">{file.name}</span>
                    <span className="shrink-0 text-muted-foreground">{Math.max(1, Math.round(file.size / 1024))} KB</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="rounded-[22px] border border-border/60 bg-background/70 p-4 text-sm">
            <div className="font-medium">Bill summary</div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Taxable value</span>
              <span className="font-medium">{Number(taxableValue || 0).toFixed(2)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Tax amount</span>
              <span className="font-medium">{(Number(cgst || 0) + Number(sgst || 0) + Number(igst || 0)).toFixed(2)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Grand total</span>
              <span className="font-semibold">{Number(form.getValues("total") || 0).toFixed(2)}</span>
            </div>
          </div>
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
