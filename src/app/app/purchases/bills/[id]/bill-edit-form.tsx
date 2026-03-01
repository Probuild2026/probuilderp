"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { updatePurchaseInvoice } from "@/app/actions/purchase-invoices";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Opt = { id: string; name: string };

function n(val: string) {
  const num = Number(val || 0);
  return Number.isFinite(num) ? num : 0;
}

export function BillEditForm({
  bill,
  projects,
  vendors,
}: {
  bill: {
    id: string;
    vendorId: string;
    projectId: string;
    invoiceNumber: string;
    invoiceDate: string;
    gstType: "INTRA" | "INTER" | "NOGST";
    taxableValue: string;
    cgst: string;
    sgst: string;
    igst: string;
    total: string;
  };
  projects: Opt[];
  vendors: Opt[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const invoiceNumberRef = useRef<HTMLInputElement>(null);

  const [vendorId, setVendorId] = useState(bill.vendorId);
  const [projectId, setProjectId] = useState(bill.projectId);
  const [invoiceNumber, setInvoiceNumber] = useState(bill.invoiceNumber);
  const [invoiceDate, setInvoiceDate] = useState(bill.invoiceDate);
  const [gstType, setGstType] = useState<"INTRA" | "INTER" | "NOGST">(bill.gstType);

  const [taxableValue, setTaxableValue] = useState(bill.taxableValue);
  const [cgst, setCgst] = useState(bill.cgst);
  const [sgst, setSgst] = useState(bill.sgst);
  const [igst, setIgst] = useState(bill.igst);

  const totalTax = useMemo(() => n(cgst) + n(sgst) + n(igst), [cgst, sgst, igst]);
  const total = useMemo(() => n(taxableValue) + totalTax, [taxableValue, totalTax]);
  const effectiveRatePct = useMemo(() => {
    const base = n(taxableValue);
    if (base <= 0) return 0;
    return (totalTax / base) * 100;
  }, [taxableValue, totalTax]);

  useEffect(() => {
    invoiceNumberRef.current?.focus();
  }, []);

  // When taxable value changes, keep the effective GST rate consistent (based on current tax fields).
  useEffect(() => {
    const base = n(taxableValue);
    if (base <= 0) {
      setCgst("0.00");
      setSgst("0.00");
      setIgst("0.00");
      return;
    }

    if (gstType === "NOGST") {
      setCgst("0.00");
      setSgst("0.00");
      setIgst("0.00");
      return;
    }

    const rate = effectiveRatePct;
    if (!Number.isFinite(rate) || rate <= 0) return;
    const tax = (base * rate) / 100;
    if (gstType === "INTRA") {
      const half = tax / 2;
      setCgst(half.toFixed(2));
      setSgst(half.toFixed(2));
      setIgst("0.00");
    } else {
      setIgst(tax.toFixed(2));
      setCgst("0.00");
      setSgst("0.00");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taxableValue, gstType]);

  // When GST type changes, convert existing tax between INTRA <-> INTER, or clear for NOGST.
  function handleGstTypeChange(next: "INTRA" | "INTER" | "NOGST") {
    if (next === gstType) return;
    const currentTax = totalTax;
    setGstType(next);
    if (next === "NOGST") {
      setIgst("0.00");
      setCgst("0.00");
      setSgst("0.00");
    } else if (next === "INTER") {
      setIgst(currentTax.toFixed(2));
      setCgst("0.00");
      setSgst("0.00");
    } else {
      const half = currentTax / 2;
      setCgst(half.toFixed(2));
      setSgst(half.toFixed(2));
      setIgst("0.00");
    }
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const payload: Record<string, any> = {
            id: bill.id,
            vendorId,
            projectId,
            invoiceNumber,
            invoiceDate,
            gstType,
            taxableValue: n(taxableValue),
            cgst: gstType === "INTRA" ? n(cgst) : 0,
            sgst: gstType === "INTRA" ? n(sgst) : 0,
            igst: gstType === "INTER" ? n(igst) : 0,
            total: Number(total.toFixed(2)),
          };
          const res = await updatePurchaseInvoice(payload);
          if (!res.ok) {
            toast.error(res.error.message);
            return;
          }
          toast.success("Bill updated.");
          router.refresh();
        });
      }}
    >
      <input type="hidden" name="id" value={bill.id} />

      <div className="rounded-md border">
        <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
          <label className="space-y-2 text-sm">
            <div className="text-muted-foreground">Vendor</div>
            <select
              className="h-10 w-full rounded-md border bg-background px-3"
              required
              value={vendorId}
              onChange={(e) => setVendorId(e.target.value)}
            >
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2 text-sm">
            <div className="text-muted-foreground">Project</div>
            <select
              className="h-10 w-full rounded-md border bg-background px-3"
              required
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2 text-sm">
            <div className="text-muted-foreground">Bill number</div>
            <Input ref={invoiceNumberRef} value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} required />
          </label>

          <label className="space-y-2 text-sm">
            <div className="text-muted-foreground">Bill date</div>
            <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} required />
          </label>

          <label className="space-y-2 text-sm">
            <div className="text-muted-foreground">GST type</div>
            <select
              className="h-10 w-full rounded-md border bg-background px-3"
              value={gstType}
              onChange={(e) => handleGstTypeChange(e.target.value as any)}
            >
              <option value="INTRA">Intra (CGST+SGST)</option>
              <option value="INTER">Inter (IGST)</option>
              <option value="NOGST">No GST</option>
            </select>
          </label>
        </div>

        <div className="border-t" />

        <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
          <label className="space-y-2 text-sm">
            <div className="text-muted-foreground">Taxable value</div>
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              value={taxableValue}
              onChange={(e) => setTaxableValue(e.target.value)}
              required
            />
          </label>

          <label className="space-y-2 text-sm">
            <div className="text-muted-foreground">Total</div>
            <Input type="number" inputMode="decimal" step="0.01" value={total.toFixed(2)} readOnly />
          </label>

          {gstType === "INTRA" ? (
            <>
              <label className="space-y-2 text-sm">
                <div className="text-muted-foreground">CGST</div>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={cgst}
                  onChange={(e) => setCgst(e.target.value)}
                />
              </label>
              <label className="space-y-2 text-sm">
                <div className="text-muted-foreground">SGST</div>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={sgst}
                  onChange={(e) => setSgst(e.target.value)}
                />
              </label>
            </>
          ) : gstType === "INTER" ? (
            <label className="space-y-2 text-sm">
              <div className="text-muted-foreground">IGST</div>
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={igst}
                onChange={(e) => setIgst(e.target.value)}
              />
            </label>
          ) : null}

          <div className="rounded-md border p-3 text-sm">
            <div className="font-medium">GST summary</div>
            <div className="mt-1 text-muted-foreground">
              Total GST {effectiveRatePct > 0 ? effectiveRatePct.toFixed(2) : "0.00"}% on {n(taxableValue).toFixed(2)} ={" "}
              {totalTax.toFixed(2)}
            </div>
            <div className="mt-1 text-muted-foreground">Total bill = {total.toFixed(2)}</div>
            <div className="mt-2 text-xs text-muted-foreground">
              Tip: Change Taxable value or GST type and totals auto-update. You can still override CGST/SGST/IGST manually.
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
