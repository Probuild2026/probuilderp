"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { createVendorPayment } from "@/app/actions/vendor-payments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatINR } from "@/lib/money";

type Opt = { id: string; name: string };
type VendorOpt = Opt & { isSubcontractor: boolean };
type PaymentMode = "CASH" | "UPI" | "BANK_TRANSFER" | "CHEQUE" | "CARD" | "OTHER";
type TdsDepositStatus = "PENDING" | "DEPOSITED";
type VendorPaymentPayload = {
  date: string;
  mode: PaymentMode;
  reference?: string;
  vendorId: string;
  projectId?: string;
  hasTransporterDeclaration: boolean;
  tdsSection: string;
  tdsDepositStatus: TdsDepositStatus;
  tdsChallanCin?: string;
  tdsChallanBsrCode?: string;
  tdsChallanNumber?: string;
  tdsChallanDate?: string;
  allocations?: Array<{ purchaseInvoiceId: string; grossAmount: number }>;
  grossAmount?: number;
};

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
  initial,
}: {
  today: string;
  projects: Opt[];
  vendors: VendorOpt[];
  initial?: { vendorId?: string; projectId?: string; billId?: string; amount?: string };
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [initialDate] = useState(() => today);

  const [vendorId, setVendorId] = useState(initial?.vendorId ?? vendors[0]?.id ?? "");
  const [bills, setBills] = useState<OpenBill[]>([]);
  const [loadingBills, setLoadingBills] = useState(false);
  const [mode, setMode] = useState<PaymentMode>("BANK_TRANSFER");
  const [reference, setReference] = useState("");
  const [projectId, setProjectId] = useState(initial?.projectId ?? projects[0]?.id ?? "");
  const [hasTransporterDeclaration, setHasTransporterDeclaration] = useState(false);
  const [tdsSection, setTdsSection] = useState("194C");
  const [tdsDepositStatus, setTdsDepositStatus] = useState<TdsDepositStatus>("PENDING");
  const [tdsChallanCin, setTdsChallanCin] = useState("");
  const [tdsChallanBsrCode, setTdsChallanBsrCode] = useState("");
  const [tdsChallanNumber, setTdsChallanNumber] = useState("");
  const [tdsChallanDate, setTdsChallanDate] = useState("");

  const [flow, setFlow] = useState<"BILLS" | "LUMP_SUM">(initial?.billId ? "BILLS" : "BILLS");
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

  // Pre-fill a specific bill once open bills are loaded.
  useEffect(() => {
    const billId = initial?.billId;
    if (!billId) return;
    if (loadingBills) return;
    if (bills.length === 0) return;

    const bill = bills.find((b) => b.id === billId);
    if (!bill) return;

    const requested = Number(initial?.amount ?? 0);
    const desired = Number.isFinite(requested) && requested > 0 ? requested : bill.balance;
    const clamped = Math.max(0, Math.min(desired, bill.balance));
    if (clamped <= 0) return;

    setFlow("BILLS");
    setSelected((s) => (s[billId] ? s : { ...s, [billId]: clamped.toFixed(2) }));
    if (bill.projectId && !projectId) setProjectId(bill.projectId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bills, loadingBills, initial?.billId, initial?.amount]);

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
      onSubmit={async (e) => {
        e.preventDefault();
        if (saving) return;
        setSaving(true);
        try {
          const fd = new FormData(e.currentTarget);
          const paymentDate = String(fd.get("date") ?? initialDate);
          const allocations =
            flow === "BILLS"
              ? selectedRows.map((r) => ({ purchaseInvoiceId: r.id, grossAmount: r.gross }))
              : [];

          const payload: VendorPaymentPayload = {
            date: paymentDate,
            mode,
            reference: reference.trim() || undefined,
            vendorId,
            projectId: projectId || undefined,
            hasTransporterDeclaration,
            tdsSection: tdsSection.trim() || "194C",
            tdsDepositStatus,
            tdsChallanCin: tdsChallanCin.trim() || undefined,
            tdsChallanBsrCode: tdsChallanBsrCode.trim() || undefined,
            tdsChallanNumber: tdsChallanNumber.trim() || undefined,
            tdsChallanDate: tdsChallanDate || undefined,
            allocations: allocations.length ? allocations : undefined,
            grossAmount: flow === "LUMP_SUM" ? Number(lumpGross || 0) : undefined,
          };

          const res = await createVendorPayment(payload);
          if (!res.ok) {
            toast.error(res.error.message);
            setSaving(false);
            return;
          }

          toast.success(
            `Saved. Cash: ${formatINR(Number(res.data.cashPaid))}, TDS: ${formatINR(Number(res.data.tdsAmount))}, Gross: ${formatINR(
              Number(res.data.grossAmount),
            )}`,
          );
          router.replace("/app/purchases/payments-made");
          router.refresh();
        } catch (err) {
          console.error(err);
          toast.error("Failed to save payment. Please try again.");
        } finally {
          setSaving(false);
        }
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
          <Input name="date" type="date" defaultValue={initialDate} required />
        </label>

        <label className="space-y-2 text-sm">
          <div className="text-muted-foreground">Mode</div>
          <select
            className="h-10 w-full rounded-md border bg-background px-3"
            value={mode}
            onChange={(e) => setMode(e.target.value as PaymentMode)}
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

      <details open className="space-y-4 rounded-md border p-4">
        <summary className="cursor-pointer text-sm font-medium">TDS challan details</summary>
        <div className="mt-1 text-xs text-muted-foreground">
          Store 26QB/27EQ challan details separately from payment references.
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="space-y-2 text-sm">
            <div className="text-muted-foreground">Section</div>
            <Input value={tdsSection} onChange={(e) => setTdsSection(e.target.value)} placeholder="194C" />
          </label>

          <label className="space-y-2 text-sm">
            <div className="text-muted-foreground">Deposit status</div>
            <select
              className="h-10 w-full rounded-md border bg-background px-3"
              value={tdsDepositStatus}
              onChange={(e) => setTdsDepositStatus(e.target.value as "PENDING" | "DEPOSITED")}
            >
              <option value="PENDING">Pending deposit</option>
              <option value="DEPOSITED">Deposited</option>
            </select>
          </label>

          <label className="space-y-2 text-sm">
            <div className="text-muted-foreground">CIN number</div>
            <Input value={tdsChallanCin} onChange={(e) => setTdsChallanCin(e.target.value)} placeholder="26051700001956IDFB" />
          </label>

          <label className="space-y-2 text-sm">
            <div className="text-muted-foreground">BSR code</div>
            <Input value={tdsChallanBsrCode} onChange={(e) => setTdsChallanBsrCode(e.target.value)} placeholder="2010003" />
          </label>

          <label className="space-y-2 text-sm">
            <div className="text-muted-foreground">Challan number</div>
            <Input value={tdsChallanNumber} onChange={(e) => setTdsChallanNumber(e.target.value)} placeholder="00007" />
          </label>

          <label className="space-y-2 text-sm">
            <div className="text-muted-foreground">Date of deposit</div>
            <Input type="date" value={tdsChallanDate} onChange={(e) => setTdsChallanDate(e.target.value)} />
          </label>
        </div>
      </details>

      <div className="flex items-center justify-end gap-3">
        <Button type="submit" disabled={saving || grossTotal <= 0}>
          {saving ? "Saving..." : "Save payment"}
        </Button>
      </div>
    </form>
  );
}
