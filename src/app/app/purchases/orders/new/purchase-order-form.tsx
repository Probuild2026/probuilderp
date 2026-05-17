"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createPurchaseOrder } from "@/app/actions/purchase-orders";

type Vendor = { id: string; name: string };
type Project = { id: string; name: string };
type Line = { description: string; unit: string; quantity: string; rate: string };

function formatINR(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);
}

export function PurchaseOrderForm({ vendors, projects }: { vendors: Vendor[]; projects: Project[] }) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);

  const [vendorId, setVendorId] = useState(vendors[0]?.id ?? "");
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [orderNumber, setOrderNumber] = useState("");
  const [orderDate, setOrderDate] = useState(today);
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([{ description: "", unit: "", quantity: "", rate: "" }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function addLine() {
    setLines((prev) => [...prev, { description: "", unit: "", quantity: "", rate: "" }]);
  }

  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateLine(idx: number, field: keyof Line, value: string) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)));
  }

  const orderTotal = lines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.rate) || 0), 0);

  async function handleSubmit() {
    setError("");
    if (!orderNumber.trim()) { setError("Order number is required."); return; }
    const parsedLines = lines.map((l) => ({
      description: l.description.trim(),
      unit: l.unit.trim() || undefined,
      quantity: Number(l.quantity),
      rate: Number(l.rate),
    }));
    if (parsedLines.some((l) => !l.description || l.quantity <= 0)) {
      setError("All line items must have a description and a positive quantity.");
      return;
    }
    setSaving(true);
    const result = await createPurchaseOrder({ vendorId, projectId, orderNumber: orderNumber.trim(), orderDate, notes: notes.trim() || undefined, lines: parsedLines });
    setSaving(false);
    if (!result.ok) { setError(result.error.message); return; }
    router.push(`/app/purchases/orders/${result.data.id}`);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[20px] border border-border/60 bg-card p-6 space-y-4">
        <h2 className="font-semibold">Order details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Vendor</Label>
            <Select value={vendorId} onValueChange={setVendorId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Project</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>PO Number</Label>
            <Input placeholder="PO-2025-001" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>PO Date</Label>
            <Input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Notes (optional)</Label>
          <Textarea placeholder="Delivery terms, special conditions…" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>

      <div className="rounded-[20px] border border-border/60 bg-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Line items</h2>
          <Button size="sm" variant="outline" onClick={addLine}><Plus className="mr-1.5 size-3.5" />Add line</Button>
        </div>

        <div className="space-y-3">
          {lines.map((line, idx) => (
            <div key={idx} className="grid gap-3 rounded-[16px] border border-border/50 bg-muted/20 p-3 sm:grid-cols-[1fr_80px_100px_120px_36px]">
              <div className="space-y-1">
                <Label className="text-xs">Description</Label>
                <Input placeholder="Cement bags, steel rods, shuttering…" value={line.description} onChange={(e) => updateLine(idx, "description", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Unit</Label>
                <Input placeholder="Bag" value={line.unit} onChange={(e) => updateLine(idx, "unit", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Qty</Label>
                <Input type="number" min="0" step="0.001" placeholder="0" value={line.quantity} onChange={(e) => updateLine(idx, "quantity", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Rate (₹)</Label>
                <Input type="number" min="0" step="0.01" placeholder="0.00" value={line.rate} onChange={(e) => updateLine(idx, "rate", e.target.value)} />
              </div>
              <div className="flex items-end pb-0.5">
                <Button size="icon" variant="ghost" className="size-9 text-muted-foreground hover:text-destructive" onClick={() => removeLine(idx)} disabled={lines.length === 1}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border/60">
          <div className="text-sm text-muted-foreground">PO Total</div>
          <div className="text-lg font-semibold tabular-nums">{formatINR(orderTotal)}</div>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-3">
        <Button onClick={handleSubmit} disabled={saving}>{saving ? "Creating…" : "Create Purchase Order"}</Button>
        <Button variant="outline" onClick={() => router.push("/app/purchases/orders")}>Cancel</Button>
      </div>
    </div>
  );
}
