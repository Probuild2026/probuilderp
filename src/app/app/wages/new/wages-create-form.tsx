"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { createLabourSheet } from "@/app/actions/wages";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatINR } from "@/lib/money";

type Opt = { id: string; name: string };

type Line = { role: string; headcount: string; rate: string };

export function LabourSheetCreateForm({ today, projects }: { today: string; projects: Opt[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [date, setDate] = useState(today);
  const [mode, setMode] = useState<"CASH" | "UPI" | "BANK_TRANSFER" | "CHEQUE" | "CARD" | "OTHER">("CASH");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");

  const [lines, setLines] = useState<Line[]>([
    { role: "Masons", headcount: "0", rate: "0" },
    { role: "Helpers", headcount: "0", rate: "0" },
  ]);

  const total = useMemo(() => {
    return lines.reduce((acc, l) => {
      const hc = Number(l.headcount || 0);
      const rate = Number(l.rate || 0);
      if (!Number.isFinite(hc) || !Number.isFinite(rate)) return acc;
      return acc + hc * rate;
    }, 0);
  }, [lines]);

  return (
    <form
      className="space-y-6 rounded-[24px] border border-border/70 bg-card p-5 md:p-6"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const payload = {
            projectId,
            date,
            mode,
            reference: reference.trim() || undefined,
            note: note.trim() || undefined,
            lines: lines
              .map((l) => ({
                role: l.role.trim(),
                headcount: Number(l.headcount || 0),
                rate: Number(l.rate || 0),
              }))
              .filter((l) => l.role && l.headcount > 0 && l.rate >= 0),
          };

          const res = await createLabourSheet(payload);
          if (!res.ok) {
            toast.error(res.error.message);
            return;
          }

          toast.success(`Saved labour sheet. Total: ${formatINR(total)}`);
          router.push("/app/wages");
          router.refresh();
        });
      }}
    >
      <Card className="border-border/60 bg-background/70">
        <CardHeader className="border-b border-border/60 pb-4">
          <CardTitle className="text-base">Payout snapshot</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 pt-5 sm:grid-cols-2">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Current total</div>
            <div className="mt-2 text-2xl font-semibold tracking-tight">{formatINR(total)}</div>
          </div>
          <div className="grid gap-3 text-sm text-muted-foreground">
            <div className="flex items-center justify-between gap-3">
              <span>Line count</span>
              <span className="font-medium text-foreground">{lines.length}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Mode</span>
              <span className="font-medium text-foreground">{mode}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm">
          <div className="text-muted-foreground">Project</div>
          <select
            className="h-10 w-full rounded-md border bg-background px-3"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            required
          >
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
          <div className="text-muted-foreground">Paid via</div>
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
          <div className="text-muted-foreground">Reference (optional)</div>
          <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UTR / notes" />
        </label>

        <label className="space-y-2 text-sm sm:col-span-2">
          <div className="text-muted-foreground">Notes (optional)</div>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Site / supervisor / remarks" rows={3} />
        </label>
      </div>

      <div className="space-y-3">
        <div className="text-sm font-medium">Lines</div>
        <div className="overflow-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/20 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Role</th>
                <th className="px-3 py-2 text-right">Count</th>
                <th className="px-3 py-2 text-right">Rate</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2 text-right">Remove</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, idx) => {
                const amount = Number(l.headcount || 0) * Number(l.rate || 0);
                return (
                  <tr key={idx} className="border-t">
                    <td className="px-3 py-2">
                      <Input
                        className="h-9"
                        value={l.role}
                        onChange={(e) =>
                          setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, role: e.target.value } : x)))
                        }
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Input
                        className="h-9 w-24 text-right"
                        type="number"
                        inputMode="numeric"
                        min="0"
                        value={l.headcount}
                        onChange={(e) =>
                          setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, headcount: e.target.value } : x)))
                        }
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Input
                        className="h-9 w-32 text-right"
                        type="number"
                        inputMode="decimal"
                        step="1"
                        min="0"
                        value={l.rate}
                        onChange={(e) =>
                          setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, rate: e.target.value } : x)))
                        }
                      />
                    </td>
                    <td className="px-3 py-2 text-right">{formatINR(Number.isFinite(amount) ? amount : 0)}</td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setLines((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== idx)))}
                      >
                        Remove
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between rounded-md border p-3 text-sm">
          <div className="text-muted-foreground">Total</div>
          <div className="text-base font-semibold">{formatINR(total)}</div>
        </div>

        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setLines((prev) => [...prev, { role: "Other", headcount: "0", rate: "0" }])}
          >
            Add line
          </Button>

          <Button type="submit" disabled={pending || total <= 0}>
            {pending ? "Saving…" : "Save labour sheet"}
          </Button>
        </div>
      </div>
    </form>
  );
}
