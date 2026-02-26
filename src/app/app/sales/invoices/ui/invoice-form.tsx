"use client";

import { useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Option = { id: string; name: string };

function to2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function InvoiceForm({
  today,
  projects,
  clients,
  defaultValues,
  submitLabel,
  onSubmit,
}: {
  today: string;
  projects: Option[];
  clients: Option[];
  defaultValues?: Partial<Record<string, string>>;
  submitLabel: string;
  onSubmit: (fd: FormData) => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState("");

  const [gstType, setGstType] = useState<"INTRA" | "INTER">(
    (defaultValues?.gstType as any) === "INTER" ? "INTER" : "INTRA",
  );
  const [gstRate, setGstRate] = useState<number>(Number(defaultValues?.gstRate ?? 18));
  const [basicValue, setBasicValue] = useState<number>(Number(defaultValues?.basicValue ?? 0));

  const computed = useMemo(() => {
    const rate = Number.isFinite(gstRate) ? gstRate : 0;
    const base = Number.isFinite(basicValue) ? basicValue : 0;
    const gst = to2((base * rate) / 100);
    const cgst = gstType === "INTRA" ? to2(gst / 2) : 0;
    const sgst = gstType === "INTRA" ? to2(gst / 2) : 0;
    const igst = gstType === "INTER" ? gst : 0;
    const total = to2(base + cgst + sgst + igst);
    return { cgst, sgst, igst, total };
  }, [basicValue, gstRate, gstType]);

  return (
    <form
      action={async (fd) => {
        setErr("");
        startTransition(async () => {
          try {
            fd.set("gstType", gstType);
            fd.set("gstRate", String(gstRate));
            fd.set("basicValue", String(basicValue));
            fd.set("cgst", String(computed.cgst));
            fd.set("sgst", String(computed.sgst));
            fd.set("igst", String(computed.igst));
            fd.set("total", String(computed.total));

            await onSubmit(fd);
          } catch (e) {
            setErr(e instanceof Error ? e.message : "Failed to save invoice.");
          }
        });
      }}
      className="space-y-6"
    >
      <Card>
        <CardHeader>
          <CardTitle>Invoice</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Project</Label>
              <select
                name="projectId"
                className="h-10 w-full rounded-md border bg-background px-3"
                defaultValue={defaultValues?.projectId ?? (projects[0]?.id ?? "")}
                required
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Client</Label>
              <select
                name="clientId"
                className="h-10 w-full rounded-md border bg-background px-3"
                defaultValue={defaultValues?.clientId ?? (clients[0]?.id ?? "")}
                required
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Invoice no.</Label>
              <Input name="invoiceNumber" defaultValue={defaultValues?.invoiceNumber ?? ""} placeholder="PB/INV/0001" />
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" name="invoiceDate" defaultValue={defaultValues?.invoiceDate ?? today} required />
            </div>
            <div className="space-y-2">
              <Label>Due date (optional)</Label>
              <Input type="date" name="dueDate" defaultValue={defaultValues?.dueDate ?? ""} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Service description (optional)</Label>
              <Textarea
                name="serviceDescription"
                rows={3}
                defaultValue={defaultValues?.serviceDescription ?? ""}
                placeholder="e.g. Stage 1 billing - RCC work"
              />
            </div>
            <div className="space-y-2">
              <Label>SAC code (optional)</Label>
              <Input name="sacCode" defaultValue={defaultValues?.sacCode ?? ""} placeholder="e.g. 9954" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>GST & Amounts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>GST type</Label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3"
                value={gstType}
                onChange={(e) => setGstType(e.target.value === "INTER" ? "INTER" : "INTRA")}
              >
                <option value="INTRA">Intra-state (CGST+SGST)</option>
                <option value="INTER">Inter-state (IGST)</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>GST rate %</Label>
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={gstRate}
                onChange={(e) => setGstRate(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Basic value</Label>
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={basicValue}
                onChange={(e) => setBasicValue(Number(e.target.value))}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>CGST</Label>
              <Input value={computed.cgst.toFixed(2)} readOnly />
            </div>
            <div className="space-y-2">
              <Label>SGST</Label>
              <Input value={computed.sgst.toFixed(2)} readOnly />
            </div>
            <div className="space-y-2">
              <Label>IGST</Label>
              <Input value={computed.igst.toFixed(2)} readOnly />
            </div>
            <div className="space-y-2">
              <Label>Total</Label>
              <Input value={computed.total.toFixed(2)} readOnly />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>TDS rate % (optional)</Label>
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                name="tdsRate"
                defaultValue={defaultValues?.tdsRate ?? ""}
                placeholder="e.g. 1"
              />
            </div>
            <div className="space-y-2">
              <Label>TDS expected (optional)</Label>
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                name="tdsAmountExpected"
                defaultValue={defaultValues?.tdsAmountExpected ?? ""}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <select
                name="status"
                className="h-10 w-full rounded-md border bg-background px-3"
                defaultValue={defaultValues?.status ?? "DUE"}
              >
                <option value="DUE">Due</option>
                <option value="PARTIAL">Partial</option>
                <option value="PAID">Paid</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {err ? <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm">{err}</div> : null}

      <div className="flex items-center justify-end gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}

