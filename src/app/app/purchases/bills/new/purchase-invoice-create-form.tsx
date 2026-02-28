"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createPurchaseInvoice } from "@/app/actions/purchase-invoices";

type Opt = { id: string; name: string };

export function PurchaseInvoiceCreateForm({
  today,
  projects,
  vendors,
}: {
  today: string;
  projects: Opt[];
  vendors: Opt[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-5 rounded-md border p-4 md:p-6"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);

        startTransition(async () => {
          const payload = Object.fromEntries(fd.entries());
          const res = await createPurchaseInvoice(payload);
          if (!res.ok) {
            toast.error(res.error.message);
            return;
          }
          toast.success("Bill saved.");
          router.push("/app/purchases/bills");
          router.refresh();
        });
      }}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm">
          <div className="text-muted-foreground">Vendor</div>
          <select name="vendorId" className="h-10 w-full rounded-md border bg-background px-3" required>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </label>

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
          <div className="text-muted-foreground">Bill number</div>
          <Input name="invoiceNumber" placeholder="e.g. INV-123" required />
        </label>

        <label className="space-y-2 text-sm">
          <div className="text-muted-foreground">Bill date</div>
          <Input type="date" name="invoiceDate" defaultValue={today} required />
        </label>

        <label className="space-y-2 text-sm">
          <div className="text-muted-foreground">GST type</div>
          <select name="gstType" className="h-10 w-full rounded-md border bg-background px-3" defaultValue="INTRA">
            <option value="INTRA">Intra (CGST+SGST)</option>
            <option value="INTER">Inter (IGST)</option>
          </select>
        </label>
        <div />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm">
          <div className="text-muted-foreground">Taxable value</div>
          <Input name="taxableValue" type="number" inputMode="decimal" step="0.01" defaultValue="0" required />
        </label>
        <label className="space-y-2 text-sm">
          <div className="text-muted-foreground">Total</div>
          <Input name="total" type="number" inputMode="decimal" step="0.01" defaultValue="0" required />
        </label>
        <label className="space-y-2 text-sm">
          <div className="text-muted-foreground">CGST</div>
          <Input name="cgst" type="number" inputMode="decimal" step="0.01" defaultValue="0" />
        </label>
        <label className="space-y-2 text-sm">
          <div className="text-muted-foreground">SGST</div>
          <Input name="sgst" type="number" inputMode="decimal" step="0.01" defaultValue="0" />
        </label>
        <label className="space-y-2 text-sm">
          <div className="text-muted-foreground">IGST</div>
          <Input name="igst" type="number" inputMode="decimal" step="0.01" defaultValue="0" />
        </label>
      </div>

      <div className="flex items-center justify-end gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save bill"}
        </Button>
      </div>
    </form>
  );
}

