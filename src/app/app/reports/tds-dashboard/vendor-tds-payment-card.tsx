"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { createVendorTdsPayment } from "@/app/actions/vendor-tds-payments";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type VendorOption = {
  id: string;
  name: string;
  pending: number;
};

function createInitialForm(fy: string, vendors: VendorOption[]) {
  return {
    vendorId: vendors[0]?.id ?? "",
    fy,
    section: "194C",
    challanNo: "",
    periodFrom: "",
    periodTo: "",
    tdsPaidAmount: "",
    paymentDate: "",
    note: "",
  };
}

export function VendorTdsPaymentCard({
  fy,
  vendors,
}: {
  fy: string;
  vendors: VendorOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState(() => createInitialForm(fy, vendors));
  const selectedVendorId = vendors.some((vendor) => vendor.id === form.vendorId) ? form.vendorId : (vendors[0]?.id ?? "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedVendorId) {
      toast.error("Select a vendor.");
      return;
    }

    startTransition(async () => {
      const res = await createVendorTdsPayment({
        ...form,
        vendorId: selectedVendorId,
        fy,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }

      toast.success("194C remittance recorded.");
      setForm({ ...createInitialForm(fy, vendors), vendorId: selectedVendorId });
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Record 194C Remittance</CardTitle>
      </CardHeader>
      <CardContent>
        {vendors.length === 0 ? (
          <div className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">
            No vendor 194C deductions are available for this FY yet. Record vendor payments with TDS first, then use this form when the TDS challan is actually paid.
          </div>
        ) : (
          <form className="space-y-3" onSubmit={submit}>
            <div className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">
              Use this only after you have actually paid the TDS challan to the government. One challan covering multiple vendors can be entered as separate vendor rows with the same challan number.
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Vendor</Label>
                <Select value={selectedVendorId} onValueChange={(value) => setForm((prev) => ({ ...prev, vendorId: value }))}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map((vendor) => (
                      <SelectItem key={vendor.id} value={vendor.id}>
                        {vendor.name} {vendor.pending > 0 ? `(Pending ${vendor.pending.toFixed(2)})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Financial year</Label>
                <Input value={fy} readOnly />
              </div>
              <div>
                <Label>Section</Label>
                <Input value={form.section} readOnly />
              </div>
              <div>
                <Label>Challan no (optional)</Label>
                <Input value={form.challanNo} onChange={(e) => setForm((prev) => ({ ...prev, challanNo: e.target.value }))} />
              </div>
              <div>
                <Label>Paid amount</Label>
                <Input inputMode="decimal" value={form.tdsPaidAmount} onChange={(e) => setForm((prev) => ({ ...prev, tdsPaidAmount: e.target.value }))} required />
              </div>
              <div>
                <Label>Payment date</Label>
                <Input type="date" value={form.paymentDate} onChange={(e) => setForm((prev) => ({ ...prev, paymentDate: e.target.value }))} required />
              </div>
              <div>
                <Label>Period from (optional)</Label>
                <Input type="date" value={form.periodFrom} onChange={(e) => setForm((prev) => ({ ...prev, periodFrom: e.target.value }))} />
              </div>
              <div>
                <Label>Period to (optional)</Label>
                <Input type="date" value={form.periodTo} onChange={(e) => setForm((prev) => ({ ...prev, periodTo: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Note</Label>
              <Textarea rows={2} value={form.note} onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))} />
            </div>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Save 194C payment"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
