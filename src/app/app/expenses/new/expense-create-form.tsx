"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { uploadBillToBlob } from "@/lib/blob-upload";
import { toast } from "sonner";

import { createExpense } from "../actions";

type Opt = { id: string; name: string };

export function ExpenseCreateForm({
  tenantId,
  today,
  projects,
  vendors,
  labourers,
}: {
  tenantId: number;
  today: string;
  projects: Opt[];
  vendors: Opt[];
  labourers: Opt[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [file, setFile] = useState<File | null>(null);

  return (
    <form
      className="space-y-5 rounded-md border p-4 md:p-6"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = new FormData(form);

        startTransition(async () => {
          try {
            if (file && file.size > 0) {
              // Avoid sending the file through Server Actions (size limits). Upload directly to Blob.
              const blob = await uploadBillToBlob({
                tenantId,
                entityPath: `expenses/tmp`,
                file,
              });
              fd.delete("bill");
              fd.set("billUrl", blob.url);
              fd.set("billName", file.name);
              fd.set("billType", file.type || "application/octet-stream");
              fd.set("billSize", String(file.size));
            }

            await createExpense(fd);
            toast.success("Expense saved.");
            router.push("/app/expenses");
            router.refresh();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to save expense.");
          }
        });
      }}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm">
          <div className="text-muted-foreground">Project</div>
          <select name="projectId" className="h-10 w-full rounded-md border bg-background px-3" required>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2 text-sm">
          <div className="text-muted-foreground">Date</div>
          <Input type="date" name="date" defaultValue={today} required />
        </label>

        <label className="space-y-2 text-sm">
          <div className="text-muted-foreground">Expense Type</div>
          <select
            name="expenseType"
            className="h-10 w-full rounded-md border bg-background px-3"
            defaultValue="OVERHEAD"
          >
            <option value="MATERIAL">Material</option>
            <option value="LABOUR">Labour</option>
            <option value="SUBCONTRACTOR">Subcontractor</option>
            <option value="OVERHEAD">Overhead</option>
          </select>
        </label>

        <label className="space-y-2 text-sm">
          <div className="text-muted-foreground">Paid via (optional)</div>
          <select name="paymentMode" className="h-10 w-full rounded-md border bg-background px-3" defaultValue="">
            <option value="">Unpaid / not recorded</option>
            <option value="UPI">UPI</option>
            <option value="BANK_TRANSFER">Bank Transfer</option>
            <option value="CASH">Cash</option>
            <option value="CHEQUE">Cheque</option>
            <option value="CARD">Card</option>
            <option value="OTHER">Other</option>
          </select>
        </label>
      </div>

      <Separator />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm">
          <div className="text-muted-foreground">Vendor (optional)</div>
          <select name="vendorId" className="h-10 w-full rounded-md border bg-background px-3" defaultValue="">
            <option value="">—</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2 text-sm">
          <div className="text-muted-foreground">Labourer (optional)</div>
          <select name="labourerId" className="h-10 w-full rounded-md border bg-background px-3" defaultValue="">
            <option value="">—</option>
            {labourers.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <Separator />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm">
          <div className="text-muted-foreground">Amount before tax</div>
          <Input type="number" inputMode="decimal" step="0.01" name="amountBeforeTax" defaultValue="0" required />
        </label>
        <label className="space-y-2 text-sm">
          <div className="text-muted-foreground">CGST</div>
          <Input type="number" inputMode="decimal" step="0.01" name="cgst" defaultValue="0" />
        </label>
        <label className="space-y-2 text-sm">
          <div className="text-muted-foreground">SGST</div>
          <Input type="number" inputMode="decimal" step="0.01" name="sgst" defaultValue="0" />
        </label>
        <label className="space-y-2 text-sm">
          <div className="text-muted-foreground">IGST</div>
          <Input type="number" inputMode="decimal" step="0.01" name="igst" defaultValue="0" />
        </label>
      </div>

      <label className="block space-y-2 text-sm">
        <div className="text-muted-foreground">Narration (optional)</div>
        <Textarea name="narration" placeholder="Notes / what this was for" rows={2} />
      </label>

      <label className="block space-y-2 text-sm">
        <div className="text-muted-foreground">Upload bill (optional)</div>
        <Input
          type="file"
          name="bill"
          accept="image/*,application/pdf"
          onChange={(ev) => setFile(ev.target.files?.[0] ?? null)}
        />
      </label>

      <div className="flex items-center justify-end gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}

