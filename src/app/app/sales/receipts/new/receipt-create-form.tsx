"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { createReceipt } from "../actions";

type InvoiceOption = {
  id: string;
  invoiceNumber: string;
  projectId: string;
  projectName: string;
  clientName: string;
};

type StageOption = {
  id: string;
  projectId: string;
  stageName: string;
  expectedBank: number;
  expectedCash: number;
  actualBank: number;
  actualCash: number;
};

function inr(v: number) {
  // Lightweight formatter; detailed formatting is handled elsewhere in the app.
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 }).format(v);
}

export function ReceiptCreateForm({
  invoices,
  stages,
  today,
}: {
  invoices: InvoiceOption[];
  stages: StageOption[];
  today: string;
}) {
  const [clientInvoiceId, setClientInvoiceId] = useState(invoices[0]?.id ?? "");
  const [channel, setChannel] = useState<"BANK" | "CASH">("BANK");
  const [mode, setMode] = useState<"CASH" | "BANK_TRANSFER" | "CHEQUE" | "UPI" | "CARD" | "OTHER">("BANK_TRANSFER");
  const [projectPaymentStageId, setProjectPaymentStageId] = useState<string>("");

  const selectedInvoice = useMemo(() => invoices.find((i) => i.id === clientInvoiceId) ?? null, [clientInvoiceId, invoices]);
  const projectStages = useMemo(
    () => (selectedInvoice ? stages.filter((s) => s.projectId === selectedInvoice.projectId) : []),
    [selectedInvoice, stages],
  );

  const selectedStage = useMemo(
    () => (projectPaymentStageId ? projectStages.find((s) => s.id === projectPaymentStageId) ?? null : null),
    [projectStages, projectPaymentStageId],
  );

  const helper = useMemo(() => {
    if (!selectedStage) return null;
    const contract = channel === "CASH" ? selectedStage.expectedCash : selectedStage.expectedBank;
    const received = channel === "CASH" ? selectedStage.actualCash : selectedStage.actualBank;
    const pending = contract - received;
    return { contract, received, pending };
  }, [selectedStage, channel]);

  return (
    <form action={createReceipt} className="space-y-5 rounded-md border p-4 md:p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm sm:col-span-2">
          <div className="text-muted-foreground">Invoice</div>
          <select
            name="clientInvoiceId"
            className="h-10 w-full rounded-md border bg-background px-3"
            value={clientInvoiceId}
            onChange={(e) => {
              setClientInvoiceId(e.target.value);
              setProjectPaymentStageId("");
            }}
            required
          >
            {invoices.map((inv) => (
              <option key={inv.id} value={inv.id}>
                {inv.invoiceNumber} — {inv.clientName} — {inv.projectName}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2 text-sm">
          <div className="text-muted-foreground">Date</div>
          <Input type="date" name="date" defaultValue={today} required />
        </label>

        <label className="space-y-2 text-sm">
          <div className="text-muted-foreground">Received as</div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className={cn(
                "h-10 rounded-md border px-3 text-sm",
                channel === "BANK" ? "border-primary bg-primary/10" : "bg-background",
              )}
              onClick={() => {
                setChannel("BANK");
                if (mode === "CASH") setMode("BANK_TRANSFER");
              }}
            >
              Bank
            </button>
            <button
              type="button"
              className={cn(
                "h-10 rounded-md border px-3 text-sm",
                channel === "CASH" ? "border-primary bg-primary/10" : "bg-background",
              )}
              onClick={() => {
                setChannel("CASH");
                setMode("CASH");
              }}
            >
              Cash
            </button>
          </div>
          <input type="hidden" name="channel" value={channel} />
        </label>

        <label className="space-y-2 text-sm">
          <div className="text-muted-foreground">Mode</div>
          <select
            name="mode"
            className="h-10 w-full rounded-md border bg-background px-3"
            value={mode}
            onChange={(e) => setMode(e.target.value as any)}
          >
            <option value="CASH">Cash</option>
            <option value="UPI">UPI</option>
            <option value="BANK_TRANSFER">Bank transfer</option>
            <option value="CHEQUE">Cheque</option>
            <option value="CARD">Card</option>
            <option value="OTHER">Other</option>
          </select>
          <div className="text-xs text-muted-foreground">
            {channel === "CASH" ? "Cash receipts require Mode = Cash." : "UPI/Bank transfer are treated as bank receipts."}
          </div>
        </label>

        <label className="space-y-2 text-sm sm:col-span-2">
          <div className="text-muted-foreground">Stage</div>
          <select
            name="projectPaymentStageId"
            className="h-10 w-full rounded-md border bg-background px-3"
            value={projectPaymentStageId}
            onChange={(e) => setProjectPaymentStageId(e.target.value)}
          >
            <option value="">Unallocated</option>
            {projectStages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.stageName}
              </option>
            ))}
          </select>
          {selectedInvoice ? (
            <div className="text-xs text-muted-foreground">Project: {selectedInvoice.projectName}</div>
          ) : null}
          {helper ? (
            <div className="mt-2 rounded-md border p-3 text-xs text-muted-foreground">
              <div className="font-medium text-foreground">For this stage ({channel}):</div>
              <div className="mt-1 grid grid-cols-1 gap-1 sm:grid-cols-3">
                <div>Contract: {inr(helper.contract)}</div>
                <div>Received: {inr(helper.received)}</div>
                <div className={cn(helper.pending <= 0 ? "text-emerald-600" : "text-amber-600")}>
                  Pending: {inr(helper.pending)}
                </div>
              </div>
            </div>
          ) : null}
        </label>

        <label className="space-y-2 text-sm">
          <div className="text-muted-foreground">Amount received</div>
          <Input name="amountReceived" type="number" inputMode="decimal" step="0.01" required />
        </label>

        <label className="space-y-2 text-sm">
          <div className="text-muted-foreground">Reference (optional)</div>
          <Input name="reference" placeholder="UPI/NEFT/IMPS ref..." />
        </label>
      </div>

      <div className="rounded-md border p-3">
        <label className="flex items-center gap-3 text-sm">
          <input className="size-4 accent-primary" type="checkbox" name="tdsDeducted" value="1" />
          <span>TDS deducted by client</span>
        </label>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="space-y-2 text-sm">
            <div className="text-muted-foreground">TDS amount (optional)</div>
            <Input name="tdsAmount" type="number" inputMode="decimal" step="0.01" defaultValue="0" />
          </label>
          <label className="space-y-2 text-sm">
            <div className="text-muted-foreground">Remarks (optional)</div>
            <Input name="remarks" placeholder="e.g. TDS certificate pending" />
          </label>
        </div>
        <div className="mt-2 text-xs text-muted-foreground">Receipt settlement uses Allocation: gross = cash received + TDS.</div>
      </div>

      <div className="flex items-center justify-end gap-3">
        <Button type="submit">Save receipt</Button>
      </div>
    </form>
  );
}

