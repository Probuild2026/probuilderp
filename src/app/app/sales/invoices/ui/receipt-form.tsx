"use client";

import { useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

function to2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function ReceiptForm({
  invoiceId,
  invoiceTotal,
  invoiceSettled,
  onSubmit,
}: {
  invoiceId: string;
  invoiceTotal: number;
  invoiceSettled: number;
  onSubmit: (fd: FormData) => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState("");
  const [tdsDeducted, setTdsDeducted] = useState(false);
  const [tdsAmount, setTdsAmount] = useState<number>(0);
  const [amount, setAmount] = useState<number>(0);
  const [allowOverCollection, setAllowOverCollection] = useState(false);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const remaining = useMemo(() => to2(Math.max(0, invoiceTotal - invoiceSettled)), [invoiceTotal, invoiceSettled]);
  const effectiveReceipt = useMemo(
    () => to2(Math.max(0, amount) + (tdsDeducted ? Math.max(0, tdsAmount) : 0)),
    [amount, tdsAmount, tdsDeducted],
  );
  const overBy = useMemo(() => to2(Math.max(0, effectiveReceipt - remaining)), [effectiveReceipt, remaining]);
  const validationMessage = useMemo(() => {
    if (amount <= 0) return "Enter a receipt amount greater than zero.";
    if (tdsDeducted && tdsAmount < 0) return "TDS amount cannot be negative.";
    if (overBy > 0 && !allowOverCollection) {
      return `This receipt exceeds the outstanding balance by ${overBy.toFixed(2)}. Enable override to continue.`;
    }
    return "";
  }, [allowOverCollection, amount, overBy, tdsAmount, tdsDeducted]);

  return (
    <form
      action={async (fd) => {
        setErr("");
        if (validationMessage) {
          setErr(validationMessage);
          return;
        }
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
      className="space-y-5"
    >
      <div className="rounded-2xl border border-dashed border-border/70 bg-muted/30 px-4 py-3">
        <div className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Open balance</div>
        <div className="mt-2 text-2xl font-semibold tracking-tight">{remaining.toFixed(2)}</div>
        <div className="mt-1 text-xs text-muted-foreground">
          Approximate amount still pending on this invoice, including unsettled TDS impact.
        </div>
      </div>

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
            className="h-12 text-lg font-semibold tabular-nums"
            required
          />
          <div className="text-xs text-muted-foreground">Actual cash or bank amount received from the client.</div>
        </div>
        <div className="space-y-2">
          <Label>Reference (optional)</Label>
          <Input name="reference" placeholder="UTR / cheque no." />
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-muted/20 px-3 py-3">
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

      <div className="rounded-2xl border border-border/70 bg-background px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Effective receipt</div>
            <div className="mt-2 text-xl font-semibold tabular-nums">{effectiveReceipt.toFixed(2)}</div>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            Counts cash plus client-deducted TDS toward settlement.
          </div>
        </div>
        {overBy > 0 ? (
          <div className="mt-3 rounded-xl border border-amber-300/70 bg-amber-50 px-3 py-3 text-sm text-amber-900">
            Receipt exceeds the current outstanding balance by {overBy.toFixed(2)}.
          </div>
        ) : null}
      </div>

      {overBy > 0 ? (
        <div className="flex items-start gap-3 rounded-xl border border-border/70 bg-muted/20 px-3 py-3">
          <Checkbox
            id="allowOverCollection"
            checked={allowOverCollection}
            onCheckedChange={(checked) => setAllowOverCollection(Boolean(checked))}
          />
          <div className="space-y-1">
            <Label htmlFor="allowOverCollection">Allow amount above remaining balance</Label>
            <div className="text-xs text-muted-foreground">
              Use this only when you intentionally want to record an advance or settlement adjustment above the current balance.
            </div>
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label>Remarks (optional)</Label>
        <Textarea name="remarks" rows={2} placeholder="Any notes about this receipt" />
      </div>

      {err ? <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm">{err}</div> : null}

      <div className="flex items-center justify-end">
        <Button type="submit" disabled={pending || Boolean(validationMessage)}>
          {pending ? "Saving…" : "Add receipt"}
        </Button>
      </div>
    </form>
  );
}
