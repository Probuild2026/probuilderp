"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { uploadBillToBlob } from "@/lib/blob-upload";
import { toast } from "sonner";

import { updateExpense } from "../actions";

type Opt = { id: string; name: string };

type ExpenseInitial = {
  id: string;
  projectId: string;
  vendorId: string;
  labourerId: string;
  date: string;
  expenseType: "MATERIAL" | "LABOUR" | "SUBCONTRACTOR" | "OVERHEAD";
  paymentMode: "" | "CASH" | "BANK_TRANSFER" | "CHEQUE" | "UPI" | "CARD" | "OTHER";
  amountBeforeTax: string;
  cgst: string;
  sgst: string;
  igst: string;
  narration: string;
};

export function ExpenseEditForm({
  tenantId,
  expense,
  projects,
  vendors,
  labourers,
}: {
  tenantId: number;
  expense: ExpenseInitial;
  projects: Opt[];
  vendors: Opt[];
  labourers: Opt[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [file, setFile] = useState<File | null>(null);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);

        startTransition(async () => {
          try {
            if (file && file.size > 0) {
              const blob = await uploadBillToBlob({
                tenantId,
                entityPath: `expenses/${expense.id}`,
                file,
              });
              fd.delete("bill");
              fd.set("billUrl", blob.url);
              fd.set("billName", file.name);
              fd.set("billType", file.type || "application/octet-stream");
              fd.set("billSize", String(file.size));
            }

            await updateExpense(fd);
            toast.success("Saved.");
            router.refresh();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Save failed.");
          }
        });
      }}
    >
      <input type="hidden" name="id" defaultValue={expense.id} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm">
          <div className="text-muted-foreground">Project</div>
          <select
            name="projectId"
            className="h-10 w-full rounded-md border bg-background px-3"
            defaultValue={expense.projectId}
            required
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2 text-sm">
          <div className="text-muted-foreground">Date</div>
          <Input type="date" name="date" defaultValue={expense.date} required />
        </label>

        <label className="space-y-2 text-sm">
          <div className="text-muted-foreground">Expense Type</div>
          <select
            name="expenseType"
            className="h-10 w-full rounded-md border bg-background px-3"
            defaultValue={expense.expenseType}
          >
            <option value="MATERIAL">Material</option>
            <option value="LABOUR">Labour</option>
            <option value="SUBCONTRACTOR">Subcontractor</option>
            <option value="OVERHEAD">Overhead</option>
          </select>
        </label>

        <label className="space-y-2 text-sm">
          <div className="text-muted-foreground">Paid via (optional)</div>
          <select
            name="paymentMode"
            className="h-10 w-full rounded-md border bg-background px-3"
            defaultValue={expense.paymentMode}
          >
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
          <select
            name="vendorId"
            className="h-10 w-full rounded-md border bg-background px-3"
            defaultValue={expense.vendorId}
          >
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
          <select
            name="labourerId"
            className="h-10 w-full rounded-md border bg-background px-3"
            defaultValue={expense.labourerId}
          >
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
          <Input type="number" inputMode="decimal" step="0.01" name="amountBeforeTax" defaultValue={expense.amountBeforeTax} required />
        </label>
        <label className="space-y-2 text-sm">
          <div className="text-muted-foreground">CGST</div>
          <Input type="number" inputMode="decimal" step="0.01" name="cgst" defaultValue={expense.cgst} />
        </label>
        <label className="space-y-2 text-sm">
          <div className="text-muted-foreground">SGST</div>
          <Input type="number" inputMode="decimal" step="0.01" name="sgst" defaultValue={expense.sgst} />
        </label>
        <label className="space-y-2 text-sm">
          <div className="text-muted-foreground">IGST</div>
          <Input type="number" inputMode="decimal" step="0.01" name="igst" defaultValue={expense.igst} />
        </label>
      </div>

      <label className="block space-y-2 text-sm">
        <div className="text-muted-foreground">Narration (optional)</div>
        <Textarea name="narration" defaultValue={expense.narration} rows={2} />
      </label>

      <label className="block space-y-2 text-sm">
        <div className="text-muted-foreground">Upload bill (optional)</div>
        <Input
          type="file"
          name="bill"
          accept="image/*,application/pdf"
          onChange={(ev) => setFile(ev.target.files?.[0] ?? null)}
        />
        <div className="text-xs text-muted-foreground">
          Uploads go directly to Blob (no size limit from the server action).
        </div>
      </label>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

