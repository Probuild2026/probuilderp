"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { updateReceipt } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ReceiptEditForm({
  receipt,
  stages,
}: {
  receipt: {
    id: string;
    clientInvoiceId: string;
    projectId: string;
    date: string;
    amountReceived: string;
    mode: "CASH" | "BANK_TRANSFER" | "CHEQUE" | "UPI" | "CARD" | "OTHER";
    channel: "BANK" | "CASH";
    projectPaymentStageId: string | null;
    reference: string | null;
    tdsDeducted: boolean;
    tdsAmount: string;
    remarks: string | null;
  };
  stages: { id: string; stageName: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [date, setDate] = useState(receipt.date);
  const [amountReceived, setAmountReceived] = useState(receipt.amountReceived);
  const [mode, setMode] = useState(receipt.mode);
  const [channel, setChannel] = useState<"BANK" | "CASH">(receipt.channel);
  const [projectPaymentStageId, setProjectPaymentStageId] = useState(receipt.projectPaymentStageId ?? "");
  const [reference, setReference] = useState(receipt.reference ?? "");
  const [remarks, setRemarks] = useState(receipt.remarks ?? "");

  const [tdsDeducted, setTdsDeducted] = useState(receipt.tdsDeducted);
  const [tdsAmount, setTdsAmount] = useState(receipt.tdsAmount);

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const payload = {
            id: receipt.id,
            clientInvoiceId: receipt.clientInvoiceId,
            date,
            amountReceived: Number(amountReceived || 0),
            mode,
            channel,
            projectPaymentStageId: projectPaymentStageId || undefined,
            reference: reference.trim() || undefined,
            tdsDeducted,
            tdsAmount: tdsDeducted ? Number(tdsAmount || 0) : 0,
            remarks: remarks.trim() || undefined,
          };

          const res = await updateReceipt(payload);
          if (!res.ok) {
            toast.error(res.error.message);
            return;
          }

          toast.success("Receipt updated.");
          router.refresh();
        });
      }}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm">
          <div className="text-muted-foreground">Date</div>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>

        <label className="space-y-2 text-sm">
          <div className="text-muted-foreground">Stage</div>
          <select
            className="h-10 w-full rounded-md border bg-background px-3"
            value={projectPaymentStageId}
            onChange={(e) => setProjectPaymentStageId(e.target.value)}
          >
            <option value="">Unallocated</option>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.stageName}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2 text-sm">
          <div className="text-muted-foreground">Received as</div>
          <select
            className="h-10 w-full rounded-md border bg-background px-3"
            value={channel}
            onChange={(e) => {
              const next = e.target.value as "BANK" | "CASH";
              setChannel(next);
              if (next === "CASH" && mode !== "CASH") setMode("CASH");
              if (next === "BANK" && mode === "CASH") setMode("BANK_TRANSFER");
            }}
          >
            <option value="BANK">Bank</option>
            <option value="CASH">Cash</option>
          </select>
        </label>

        <label className="space-y-2 text-sm">
          <div className="text-muted-foreground">Mode</div>
          <select
            className="h-10 w-full rounded-md border bg-background px-3"
            value={mode}
            onChange={(e) => setMode(e.target.value as any)}
          >
            <option value="CASH">Cash</option>
            <option value="UPI">UPI</option>
            <option value="BANK_TRANSFER">Bank Transfer</option>
            <option value="CHEQUE">Cheque</option>
            <option value="CARD">Card</option>
            <option value="OTHER">Other</option>
          </select>
        </label>

        <label className="space-y-2 text-sm">
          <div className="text-muted-foreground">Cash received</div>
          <Input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={amountReceived}
            onChange={(e) => setAmountReceived(e.target.value)}
            required
          />
        </label>

        <label className="flex items-end gap-3 rounded-md border p-3 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={tdsDeducted}
            onChange={(e) => setTdsDeducted(e.target.checked)}
          />
          <div>
            <div className="font-medium">TDS deducted</div>
            <div className="text-xs text-muted-foreground">Client deducted TDS; gross = cash + TDS.</div>
          </div>
        </label>

        <label className="space-y-2 text-sm">
          <div className="text-muted-foreground">TDS amount</div>
          <Input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={tdsAmount}
            onChange={(e) => setTdsAmount(e.target.value)}
            disabled={!tdsDeducted}
          />
        </label>

        <label className="space-y-2 text-sm sm:col-span-2">
          <div className="text-muted-foreground">Reference (optional)</div>
          <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UTR / notes" />
        </label>

        <label className="space-y-2 text-sm sm:col-span-2">
          <div className="text-muted-foreground">Remarks (optional)</div>
          <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Any notes" />
        </label>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
