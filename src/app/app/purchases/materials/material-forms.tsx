"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { createMaterialOrder, createMaterialReceipt, linkMaterialReceiptToBill } from "@/app/actions/material-tracking";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type Option = { id: string; name: string };
type ItemOption = Option & { unit?: string | null };
type OrderOption = {
  id: string;
  label: string;
  projectId: string;
  vendorId: string;
  itemId: string;
  stageName?: string | null;
  rate?: number | null;
};
export type BillOption = {
  id: string;
  label: string;
  projectId: string;
  vendorId: string;
  balance: number;
};

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function formPayload(form: HTMLFormElement) {
  return Object.fromEntries(new FormData(form).entries());
}

export function NewMaterialOrderDialog({
  projects,
  vendors,
  items,
  selectedProjectId,
}: {
  projects: Option[];
  vendors: Option[];
  items: ItemOption[];
  selectedProjectId?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const today = useMemo(() => todayString(), []);
  const defaultProjectId = projects.some((project) => project.id === selectedProjectId) ? selectedProjectId : projects[0]?.id ?? "";
  const disabled = projects.length === 0 || vendors.length === 0 || items.length === 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>New material order</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Material order</DialogTitle>
          <DialogDescription>Capture what was ordered before the delivery challan or vendor bill arrives.</DialogDescription>
        </DialogHeader>

        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            startTransition(async () => {
              const res = await createMaterialOrder(formPayload(form));
              if (!res.ok) {
                toast.error(res.error.message);
                return;
              }
              toast.success("Material order saved.");
              form.reset();
              setOpen(false);
              router.refresh();
            });
          }}
        >
          {disabled ? (
            <div className="rounded-md border p-4 text-sm text-muted-foreground">
              Add at least one project, vendor, and material item first.
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Project">
              <select name="projectId" defaultValue={defaultProjectId} required className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Vendor">
              <select name="vendorId" required className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                {vendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Material">
              <select name="itemId" required className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                    {item.unit ? ` (${item.unit})` : ""}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Order date">
              <Input name="orderDate" type="date" defaultValue={today} required />
            </Field>
            <Field label="Expected delivery">
              <Input name="expectedDeliveryDate" type="date" />
            </Field>
            <Field label="Quantity ordered">
              <Input name="quantityOrdered" type="number" inputMode="decimal" step="0.001" defaultValue="1" required />
            </Field>
            <Field label="Rate">
              <Input name="rate" type="number" inputMode="decimal" step="0.01" placeholder="Optional" />
            </Field>
            <Field label="Reference">
              <Input name="reference" placeholder="PO no, WhatsApp ref..." />
            </Field>
          </div>

          <Field label="Stage / area">
            <Input name="stageName" placeholder="Foundation, slab, plastering, site store..." />
          </Field>
          <Field label="Remarks">
            <Input name="remarks" placeholder="Optional note" />
          </Field>

          <div className="flex justify-end">
            <Button type="submit" disabled={pending || disabled}>
              {pending ? "Saving..." : "Save order"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function NewMaterialReceiptDialog({
  projects,
  vendors,
  items,
  orders,
  bills,
  selectedProjectId,
}: {
  projects: Option[];
  vendors: Option[];
  items: ItemOption[];
  orders: OrderOption[];
  bills: BillOption[];
  selectedProjectId?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const today = useMemo(() => todayString(), []);
  const initialProjectId = projects.some((project) => project.id === selectedProjectId) ? selectedProjectId : projects[0]?.id ?? "";
  const [projectId, setProjectId] = useState(initialProjectId);
  const [vendorId, setVendorId] = useState(vendors[0]?.id ?? "");
  const [itemId, setItemId] = useState(items[0]?.id ?? "");
  const [orderId, setOrderId] = useState("");
  const [stageName, setStageName] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const disabled = projects.length === 0 || vendors.length === 0 || items.length === 0;
  const matchingBills = bills.filter((bill) => bill.projectId === projectId && bill.vendorId === vendorId);

  function applyOrder(nextOrderId: string) {
    setOrderId(nextOrderId);
    const order = orders.find((entry) => entry.id === nextOrderId);
    if (!order) return;
    setProjectId(order.projectId);
    setVendorId(order.vendorId);
    setItemId(order.itemId);
    setStageName(order.stageName ?? "");
    setUnitCost(order.rate == null ? "" : String(order.rate));
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary">Record delivery</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Material delivery</DialogTitle>
          <DialogDescription>Record a delivery challan. This creates stock IN and can be tied to a vendor bill now or later.</DialogDescription>
        </DialogHeader>

        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            startTransition(async () => {
              const res = await createMaterialReceipt(formPayload(form));
              if (!res.ok) {
                toast.error(res.error.message);
                return;
              }
              toast.success("Material delivery saved.");
              form.reset();
              setOrderId("");
              setOpen(false);
              router.refresh();
            });
          }}
        >
          {disabled ? (
            <div className="rounded-md border p-4 text-sm text-muted-foreground">
              Add at least one project, vendor, and material item first.
            </div>
          ) : null}

          <Field label="Against order">
            <select name="materialOrderId" value={orderId} onChange={(event) => applyOrder(event.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              <option value="">No linked order</option>
              {orders.map((order) => (
                <option key={order.id} value={order.id}>
                  {order.label}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Project">
              <select name="projectId" value={projectId} onChange={(event) => setProjectId(event.target.value)} required className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Vendor">
              <select name="vendorId" value={vendorId} onChange={(event) => setVendorId(event.target.value)} required className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                {vendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Material">
              <select name="itemId" value={itemId} onChange={(event) => setItemId(event.target.value)} required className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                    {item.unit ? ` (${item.unit})` : ""}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Delivery date">
              <Input name="receiptDate" type="date" defaultValue={today} required />
            </Field>
            <Field label="Challan number">
              <Input name="challanNumber" placeholder="DC / delivery note no." />
            </Field>
            <Field label="Quantity delivered">
              <Input name="quantity" type="number" inputMode="decimal" step="0.001" defaultValue="1" required />
            </Field>
            <Field label="Unit cost">
              <Input name="unitCost" type="number" inputMode="decimal" step="0.01" value={unitCost} onChange={(event) => setUnitCost(event.target.value)} placeholder="Optional" />
            </Field>
            <Field label="Vehicle number">
              <Input name="vehicleNumber" placeholder="Optional" />
            </Field>
          </div>

          <Field label="Bill link">
            <select name="purchaseInvoiceId" className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              <option value="">Unbilled for now</option>
              {matchingBills.map((bill) => (
                <option key={bill.id} value={bill.id}>
                  {bill.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Stage / area">
            <Input name="stageName" value={stageName} onChange={(event) => setStageName(event.target.value)} placeholder="Foundation, slab, plastering, site store..." />
          </Field>
          <Field label="Remarks">
            <Input name="remarks" placeholder="Optional note" />
          </Field>

          <div className="flex justify-end">
            <Button type="submit" disabled={pending || disabled}>
              {pending ? "Saving..." : "Save delivery"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function LinkReceiptBillForm({
  receiptId,
  projectId,
  vendorId,
  bills,
}: {
  receiptId: string;
  projectId: string;
  vendorId: string;
  bills: BillOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [purchaseInvoiceId, setPurchaseInvoiceId] = useState("");
  const matchingBills = bills.filter((bill) => bill.projectId === projectId && bill.vendorId === vendorId);

  if (matchingBills.length === 0) {
    return (
      <Button asChild size="sm" variant="outline">
        <Link href={`/app/purchases/bills/new?receiptId=${encodeURIComponent(receiptId)}`}>Create bill</Link>
      </Button>
    );
  }

  return (
    <form
      className="flex min-w-[280px] items-center justify-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (!purchaseInvoiceId) {
          toast.error("Select a bill first.");
          return;
        }
        startTransition(async () => {
          const res = await linkMaterialReceiptToBill({ receiptId, purchaseInvoiceId });
          if (!res.ok) {
            toast.error(res.error.message);
            return;
          }
          toast.success("Delivery linked to bill.");
          router.refresh();
        });
      }}
    >
      <select value={purchaseInvoiceId} onChange={(event) => setPurchaseInvoiceId(event.target.value)} className="h-9 min-w-0 flex-1 rounded-md border bg-background px-2 text-xs">
        <option value="">Select bill</option>
        {matchingBills.map((bill) => (
          <option key={bill.id} value={bill.id}>
            {bill.label}
          </option>
        ))}
      </select>
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        Link
      </Button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-2 text-sm">
      <div className="font-medium text-muted-foreground">{label}</div>
      {children}
    </label>
  );
}
