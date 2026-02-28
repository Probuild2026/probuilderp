"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { createVendorPayment } from "@/app/actions/vendor-payments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatINR } from "@/lib/money";

type Opt = { id: string; name: string };
type VendorOpt = Opt & { isSubcontractor: boolean };

type OpenBill = {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  projectId: string;
  projectName: string;
  total: number;
  paid: number;
  balance: number;
};

export function VendorPaymentCreateForm({
  today,
  projects,
  vendors,
}: {
  today: string;
  projects: Opt[];
  vendors: VendorOpt[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [vendorId, setVendorId] = useState(vendors[0]?.id ?? "");
  const [bills, setBills] = useState<OpenBill[]>([]);
  const [loadingBills, setLoadingBills] = useState(false);
  const [mode, setMode] = useState<"CASH" | "UPI" | "BANK_TRANSFER" | "CHEQUE" | "CARD" | "OTHER">("BANK_TRANSFER");
  const [reference, setReference] = useState("");
  const [date, setDate] = useState(today);
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [hasTransporterDeclaration, setHasTransporterDeclaration] = useState(false);

  const [flow, setFlow] = useState<"BILLS" | "LUMP_SUM">("BILLS");
  const [lumpGross, setLumpGross] = useState("0");

  const [selected, setSelected] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!vendorId) return;
    setLoadingBills(true);
    setBills([]);
    setSelected({});
    fetch(`/api/purchases/open-bills?vendorId=${encodeURIComponent(vendorId)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("Failed to load bills");
        const data = await r.json();
        setBills((data.items ?? []) as OpenBill[]);
      })
      .catch((e) => {
        console.error(e);
        toast.error("Failed to load open bills.");
      })
      .finally(() => setLoadingBills(false));
  }, [vendorId]);

  const selectedRows = useMemo(() => {
    return Object.entries(selected)
      .map(([id, grossStr]) => ({ id, gross: Number(grossStr || 0) }))
      .filter((x) => x.gross > 0);
  }, [selected]);

  const grossTotal = useMemo(() => {
    if (flow === "LUMP_SUM") return Number(lumpGross || 0);
    return selectedRows.reduce((a, r) => a + r.gross, 0);
  }, [flow, lumpGross, selectedRows]);

  const vendorLabel = useMemo(() => {
    const v = vendors.find((x) => x.id === vendorId);
    return v?.name ?? "";
  }, [vendors, vendorId]);

  return (
    <form
      className="space-y-5 rounded-md border p-4 md:p-6"
      onSubmit={(e) => {
        e.preventDefault();

        startTransition(async () => {
          const allocations =
            flow === "BILLS"
              ? selectedRows.map((r) => ({ purchaseInvoiceId: r.id, grossAmount: r.gross }))
              : [];

          const payload: any = {
            date,
            mode,
            reference: reference.trim() || undefined,
            vendorId,
            projectId: projectId || undefined,
            hasTransporterDeclaration,
            allocations: allocations.length ? allocations : undefined,
            grossAmount: flow === "LUMP_SUM" ? Number(lumpGross || 0) : undefined,
          };

          const res = await createVendorPayment(payload);
          if (!res.ok) {
            toast.error(res.error.message);
            return;
          }

          toast.success(
            `Saved. Cash: ${formatINR(Number(res.data.cashPaid))}, TDS: ${formatINR(Number(res.data.tdsAmount))}, Gross: ${formatINR(
              Number(res.data.grossAmount),
            )}`,
          );
          router.push("/app/purchases/payments-made");
          router.refresh();
        });
      }}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm">
          <div className="text-muted-foreground">Vendor / Subcontractor</div>
          <select
            className="h-10 w-full rounded-md border bg-background px-3"
            value={vendorId}
            onChange={(e) => setVendorId(e.target.value)}
            required
          >
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2 text-sm">
          <div className="text-muted-foreground">Project (optional)</div>
          <select
            className="h-10 w-full rounded-md border bg-background px-3"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          >
            <option value="">—</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2 text-sm">
          <div className="text-muted-foreground">Date</div>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>

        <label className="space-y-2 text-sm">
          <div className="text-muted-foreground">Mode</div>
          <select
            className="h-10 w-full rounded-md border bg-background px-3"
            value={mode}
            onChange={(e) => setMode(e.target.value as any)}
          >
            <option value="BANK_TRANSFER">Bank Transfer</option>
            <option value="UPI">UPI</option>
            <option value="CASH">Cash</option>
            <option value="CHEQUE">Cheque</option>
            <option value="CARD">Card</option>
            <option value="OTHER">Other</option>
          </select>
        </label>

        <label className="space-y-2 text-sm sm:col-span-2">
          <div className="text-muted-foreground">Reference (optional)</div>
          <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UTR / cheque no / notes" />
        </label>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="flow"
              checked={flow === "BILLS"}
              onChange={() => setFlow("BILLS")}
            />
            Settle bills
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="flow"
              checked={flow === "LUMP_SUM"}
              onChange={() => setFlow("LUMP_SUM")}
            />
            Lump‑sum (no bill)
          </label>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={hasTransporterDeclaration}
            onChange={(e) => setHasTransporterDeclaration(e.target.checked)}
          />
          Transporter declaration
        </label>
      </div>

      {flow === "LUMP_SUM" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="space-y-2 text-sm">
            <div className="text-muted-foreground">Gross amount (contract value)</div>
            <Input
              inputMode="decimal"
              type="number"
              step="0.01"
              value={lumpGross}
              onChange={(e) => setLumpGross(e.target.value)}
            />
          </label>
          <div className="rounded-md border p-3 text-sm">
            <div className="font-medium">TDS preview</div>
            <div className="mt-1 text-muted-foreground">
              TDS is auto-calculated on save based on vendor rules + FY thresholds.
            </div>
            <div className="mt-2">
              Gross: <span className="font-medium">{formatINR(grossTotal)}</span>
            </div>
            <div className="text-xs text-muted-foreground">Vendor: {vendorLabel}</div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-sm font-medium">Open bills</div>
          {loadingBills ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : bills.length === 0 ? (
            <div className="text-sm text-muted-foreground">No open bills for this vendor. Use lump‑sum if needed.</div>
          ) : (
            <div className="overflow-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/20 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Bill</th>
                    <th className="px-3 py-2 text-left">Project</th>
                    <th className="px-3 py-2 text-right">Balance</th>
                    <th className="px-3 py-2 text-right">Settle (gross)</th>
                  </tr>
                </thead>
                <tbody>
                  {bills.map((b) => (
                    <tr key={b.id} className="border-t">
                      <td className="px-3 py-2">
                        <div className="font-medium">{b.invoiceNumber}</div>
                        <div className="text-xs text-muted-foreground">{b.invoiceDate}</div>
                      </td>
                      <td className="px-3 py-2">{b.projectName}</td>
                      <td className="px-3 py-2 text-right">{formatINR(b.balance)}</td>
                      <td className="px-3 py-2 text-right">
                        <Input
                          className="h-9 w-40 text-right"
                          inputMode="decimal"
                          type="number"
                          step="0.01"
                          min="0"
                          max={String(b.balance)}
                          value={selected[b.id] ?? ""}
                          onChange={(e) => setSelected((s) => ({ ...s, [b.id]: e.target.value }))}
                          placeholder="0.00"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="rounded-md border p-3 text-sm">
            <div className="font-medium">Summary</div>
            <div className="mt-1">
              Gross selected: <span className="font-medium">{formatINR(grossTotal)}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              TDS and net cash paid are calculated on save (194C + thresholds).
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        <Button type="submit" disabled={pending || grossTotal <= 0}>
          {pending ? "Saving…" : "Save payment"}
        </Button>
      </div>
    </form>
  );
}

