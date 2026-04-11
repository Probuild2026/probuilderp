"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

type Option = { id: string; name: string };

function to2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-5">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold tracking-wide">{title}</h3>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
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
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState("");
  const [dirty, setDirty] = useState(false);

  const initialGstType = defaultValues?.gstType === "INTER" ? "INTER" : "INTRA";
  const initialGstRate = Number(defaultValues?.gstRate ?? 18);
  const initialBasicValue = Number(defaultValues?.basicValue ?? 0);

  const [gstType, setGstType] = useState<"INTRA" | "INTER">(initialGstType);
  const [gstRate, setGstRate] = useState<number>(initialGstRate);
  const [basicValue, setBasicValue] = useState<number>(initialBasicValue);

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

  const initialSnapshot = useMemo(
    () =>
      JSON.stringify({
        projectId: defaultValues?.projectId ?? (projects[0]?.id ?? ""),
        clientId: defaultValues?.clientId ?? (clients[0]?.id ?? ""),
        invoiceNumber: defaultValues?.invoiceNumber ?? "",
        invoiceDate: defaultValues?.invoiceDate ?? today,
        dueDate: defaultValues?.dueDate ?? "",
        serviceDescription: defaultValues?.serviceDescription ?? "",
        sacCode: defaultValues?.sacCode ?? "",
        gstType: initialGstType,
        gstRate: String(initialGstRate),
        basicValue: String(initialBasicValue),
        tdsRate: defaultValues?.tdsRate ?? "",
        tdsAmountExpected: defaultValues?.tdsAmountExpected ?? "",
        status: defaultValues?.status ?? "DUE",
      }),
    [clients, defaultValues, initialBasicValue, initialGstRate, initialGstType, projects, today],
  );

  const getSnapshot = useCallback(
    (form: HTMLFormElement) => {
      const fd = new FormData(form);
      return JSON.stringify({
        projectId: String(fd.get("projectId") ?? ""),
        clientId: String(fd.get("clientId") ?? ""),
        invoiceNumber: String(fd.get("invoiceNumber") ?? ""),
        invoiceDate: String(fd.get("invoiceDate") ?? ""),
        dueDate: String(fd.get("dueDate") ?? ""),
        serviceDescription: String(fd.get("serviceDescription") ?? ""),
        sacCode: String(fd.get("sacCode") ?? ""),
        gstType,
        gstRate: String(gstRate),
        basicValue: String(basicValue),
        tdsRate: String(fd.get("tdsRate") ?? ""),
        tdsAmountExpected: String(fd.get("tdsAmountExpected") ?? ""),
        status: String(fd.get("status") ?? ""),
      });
    },
    [basicValue, gstRate, gstType],
  );

  function recomputeDirty() {
    if (!formRef.current) return;
    setDirty(getSnapshot(formRef.current) !== initialSnapshot);
  }

  function handleReset() {
    formRef.current?.reset();
    setErr("");
    setGstType(initialGstType);
    setGstRate(initialGstRate);
    setBasicValue(initialBasicValue);
    setDirty(false);
  }

  useEffect(() => {
    if (!formRef.current) return;
    setDirty(getSnapshot(formRef.current) !== initialSnapshot);
  }, [getSnapshot, initialSnapshot]);

  return (
    <form
      ref={formRef}
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
      onChange={recomputeDirty}
    >
      <FormSection
        title="Invoice identity"
        description="Assign the billing parties, number, dates, and service scope for this invoice."
      >
        <div className="space-y-4">
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
              <Input
                name="invoiceNumber"
                defaultValue={defaultValues?.invoiceNumber ?? ""}
                placeholder="PB/INV/0001"
                required
              />
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
        </div>
      </FormSection>

      <Separator />

      <FormSection
        title="Tax and amounts"
        description="Set the GST treatment, review the computed totals, and capture any expected client TDS."
      >
        <div className="space-y-4">
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
        </div>
      </FormSection>

      {err ? <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm">{err}</div> : null}

      {dirty || pending ? (
        <div className="sticky bottom-4 z-20">
          <div className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-background/95 px-4 py-4 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm">
              <div className="font-medium">{pending ? "Saving changes..." : "You have unsaved changes."}</div>
              <div className="text-muted-foreground">Review the invoice details and save to update totals and status.</div>
            </div>
            <div className="flex items-center gap-3">
              <Button type="button" variant="outline" onClick={handleReset} disabled={pending}>
                Reset
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving..." : submitLabel}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}
