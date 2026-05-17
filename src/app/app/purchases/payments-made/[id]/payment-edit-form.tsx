"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { updateVendorPaymentMeta } from "@/app/actions/vendor-payments";

const schema = z.object({
  id: z.string().min(1),
  date: z.string().min(1),
  mode: z.enum(["CASH", "BANK_TRANSFER", "CHEQUE", "UPI", "CARD", "OTHER"]),
  projectId: z.string().optional(),
  reference: z.union([z.string(), z.literal("")]).optional(),
  note: z.union([z.string(), z.literal("")]).optional(),
  description: z.union([z.string(), z.literal("")]).optional(),
  tdsSection: z.union([z.string(), z.literal("")]).optional(),
  tdsDepositStatus: z.enum(["PENDING", "DEPOSITED"]),
  tdsChallanCin: z.union([z.string(), z.literal("")]).optional(),
  tdsChallanBsrCode: z.union([z.string(), z.literal("")]).optional(),
  tdsChallanNumber: z.union([z.string(), z.literal("")]).optional(),
  tdsChallanDate: z.union([z.string(), z.literal("")]).optional(),
});

type FormInput = z.infer<typeof schema>;

export function PaymentEditForm({
  payment,
  projects,
}: {
  payment: {
    id: string;
    date: string;
    mode: "CASH" | "BANK_TRANSFER" | "CHEQUE" | "UPI" | "CARD" | "OTHER";
    projectId: string | null;
    reference: string | null;
    note: string | null;
    description: string | null;
    tdsSection: string | null;
    tdsDepositStatus: "PENDING" | "DEPOSITED";
    tdsChallanCin: string | null;
    tdsChallanBsrCode: string | null;
    tdsChallanNumber: string | null;
    tdsChallanDate: string | null;
  };
  projects: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const NONE = "__none__";

  const form = useForm<FormInput>({
    resolver: zodResolver(schema),
    defaultValues: {
      id: payment.id,
      date: payment.date,
      mode: payment.mode,
      projectId: payment.projectId ?? NONE,
      reference: payment.reference ?? "",
      note: payment.note ?? "",
      description: payment.description ?? "",
      tdsSection: payment.tdsSection ?? "194C",
      tdsDepositStatus: payment.tdsDepositStatus,
      tdsChallanCin: payment.tdsChallanCin ?? "",
      tdsChallanBsrCode: payment.tdsChallanBsrCode ?? "",
      tdsChallanNumber: payment.tdsChallanNumber ?? "",
      tdsChallanDate: payment.tdsChallanDate ?? "",
    },
  });

  function onSubmit(values: FormInput) {
    startTransition(async () => {
      const res = await updateVendorPaymentMeta({
        id: values.id,
        date: values.date,
        mode: values.mode,
        projectId: values.projectId && values.projectId !== NONE ? values.projectId.trim() : undefined,
        reference: values.reference?.trim() ? values.reference.trim() : undefined,
        note: values.note?.trim() ? values.note.trim() : undefined,
        description: values.description?.trim() ? values.description.trim() : undefined,
        tdsSection: values.tdsSection?.trim() ? values.tdsSection.trim() : undefined,
        tdsDepositStatus: values.tdsDepositStatus,
        tdsChallanCin: values.tdsChallanCin?.trim() ? values.tdsChallanCin.trim() : undefined,
        tdsChallanBsrCode: values.tdsChallanBsrCode?.trim() ? values.tdsChallanBsrCode.trim() : undefined,
        tdsChallanNumber: values.tdsChallanNumber?.trim() ? values.tdsChallanNumber.trim() : undefined,
        tdsChallanDate: values.tdsChallanDate?.trim() ? values.tdsChallanDate.trim() : undefined,
      });

      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }

      toast.success("Payment updated.");
      router.refresh();
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            name="mode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Mode</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select mode" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="CASH">Cash</SelectItem>
                    <SelectItem value="UPI">UPI</SelectItem>
                    <SelectItem value="BANK_TRANSFER">Bank transfer</SelectItem>
                    <SelectItem value="CHEQUE">Cheque</SelectItem>
                    <SelectItem value="CARD">Card</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="projectId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Project (optional)</FormLabel>
              <Select value={field.value ?? NONE} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value={NONE}>—</SelectItem>
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
          name="reference"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Reference (optional)</FormLabel>
              <FormControl>
                <Input placeholder="UPI/IFT/IMPS ref..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <details open className="space-y-4 rounded-md border p-4">
          <summary className="cursor-pointer text-sm font-medium">TDS challan details</summary>
          <div className="mt-1 text-xs text-muted-foreground">
            Keep CIN, BSR, challan number, and deposit status out of the free-text reference field.
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="tdsSection"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Section</FormLabel>
                  <FormControl>
                    <Input placeholder="194C" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tdsDepositStatus"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Deposit status</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select deposit status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="PENDING">Pending deposit</SelectItem>
                      <SelectItem value="DEPOSITED">Deposited</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tdsChallanCin"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CIN number</FormLabel>
                  <FormControl>
                    <Input placeholder="26051700001956IDFB" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tdsChallanBsrCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>BSR code</FormLabel>
                  <FormControl>
                    <Input placeholder="2010003" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tdsChallanNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Challan number</FormLabel>
                  <FormControl>
                    <Input placeholder="00007" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tdsChallanDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date of deposit</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </details>

        <FormField
          control={form.control}
          name="note"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Note (optional)</FormLabel>
              <FormControl>
                <Textarea rows={2} placeholder="Short note" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description (optional)</FormLabel>
              <FormControl>
                <Textarea rows={3} placeholder="More details…" {...field} />
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
  );
}
