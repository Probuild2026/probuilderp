"use client";

import { useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

function to2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function ReceiptForm({
  invoiceId,
  invoiceTotal,
  invoiceReceived,
  onSubmit,
}: {
  invoiceId: string;
  invoiceTotal: number;
  invoiceReceived: number;
  onSubmit: (fd: FormData) => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState("");
  const [tdsDeducted, setTdsDeducted] = useState(false);
  const [tdsAmount, setTdsAmount] = useState<number>(0);
  const [amount, setAmount] = useState<number>(0);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const remaining = useMemo(() => to2(Math.max(0, invoiceTotal - invoiceReceived)), [invoiceTotal, invoiceReceived]);

  return (
    <form
      action={async (fd) => {
        setErr("");
        startTransition(async () => {
          try {
            fd.set("clientInvoiceId", invoiceId);
            fd.set("tdsDeducted", tdsDeducted ? "1" : "0");
            fd.set("tdsAmount", tdsDeducted ? String(tdsAmount) : "");
            fd.set("amountReceived", String(amount));
            await onSubmit(fd);
          } catch (e) {
            setErr(e instanceof Error ? e.message : "Failed to save receipt.");
          }
        });
      }}
      className="space-y-4"
    >
      <div className="text-xs text-muted-foreground">Remaining (approx): {remaining.toFixed(2)}</div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Date</Label>
          <Input type="date" name="date" defaultValue={today} required />
        </div>
        <div className="space-y-2">
          <Label>Mode</Label>
          <select name="mode" className="h-10 w-full rounded-md border bg-background px-3" defaultValue="BANK_TRANSFER">
            <option value="BANK_TRANSFER">Bank Transfer</option>
            <option value="UPI">UPI</option>
            <option value="CASH">Cash</option>
            <option value="CHEQUE">Cheque</option>
            <option value="CARD">Card</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Amount received (net)</Label>
          <Input
            type="number"
            inputMode="decimal"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Reference (optional)</Label>
          <Input name="reference" placeholder="UTR / cheque no." />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          id="tdsDeducted"
          type="checkbox"
          checked={tdsDeducted}
          onChange={(e) => setTdsDeducted(e.target.checked)}
        />
        <Label htmlFor="tdsDeducted">TDS deducted by client</Label>
      </div>

      {tdsDeducted ? (
        <div className="space-y-2">
          <Label>TDS amount</Label>
          <Input
            type="number"
            inputMode="decimal"
            step="0.01"
            value={tdsAmount}
            onChange={(e) => setTdsAmount(Number(e.target.value))}
          />
        </div>
      ) : null}

      <div className="space-y-2">
        <Label>Remarks (optional)</Label>
        <Textarea name="remarks" rows={2} placeholder="Any notes about this receipt" />
      </div>

      {err ? <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm">{err}</div> : null}

      <div className="flex items-center justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Add receipt"}
        </Button>
      </div>
    </form>
  );
}

