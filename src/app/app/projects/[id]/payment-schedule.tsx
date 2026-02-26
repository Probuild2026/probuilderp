"use client";

import { useMemo, useState, useTransition } from "react";
import type { ProjectPaymentStage } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

import { deletePaymentStage, importPaymentScheduleCsv, upsertPaymentStage } from "./actions";

type DecimalLike = { toFixed: (fractionDigits: number) => string };

function money(v: DecimalLike | number | null | undefined) {
  if (typeof v === "number") return v.toFixed(2);
  if (v && typeof v.toFixed === "function") return v.toFixed(2);
  return "0.00";
}

export function PaymentSchedule({
  projectId,
  stages,
}: {
  projectId: string;
  stages: ProjectPaymentStage[];
}) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<ProjectPaymentStage | null>(null);

  const totals = useMemo(() => {
    let exp = 0;
    let act = 0;
    for (const s of stages) {
      const ea = Number(money(s.expectedAmount));
      const ab = Number(money(s.actualBank));
      const ac = Number(money(s.actualCash));
      exp += ea;
      act += ab + ac;
    }
    return { expected: exp, actual: act, balance: exp - act };
  }, [stages]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Payment Schedule</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Expected vs actual stage-wise payments. Import CSV once, then edit anytime.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <a href={`/api/projects/${projectId}/payment-schedule-csv`}>Download CSV</a>
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="secondary">Import CSV</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Import schedule CSV</DialogTitle>
              </DialogHeader>
              <form
                action={(fd) => {
                  fd.set("projectId", projectId);
                  startTransition(async () => {
                    try {
                      await importPaymentScheduleCsv(fd);
                      toast.success("Schedule imported.");
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Import failed.");
                    }
                  });
                }}
                className="space-y-3"
              >
                <Input type="file" name="file" accept=".csv,text/csv" required />
                <p className="text-xs text-muted-foreground">
                  Import overwrites the existing schedule for this project.
                </p>
                <Button type="submit" disabled={pending} className="w-full">
                  {pending ? "Importing…" : "Import"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          <Button
            onClick={() =>
              setEditing({
                id: "new",
                tenantId: 1,
                stageName: "",
                scopeOfWork: null,
                percent: null,
                expectedAmount: 0 as unknown as ProjectPaymentStage["expectedAmount"],
                expectedBank: 0 as unknown as ProjectPaymentStage["expectedBank"],
                expectedCash: 0 as unknown as ProjectPaymentStage["expectedCash"],
                actualBank: 0 as unknown as ProjectPaymentStage["actualBank"],
                actualCash: 0 as unknown as ProjectPaymentStage["actualCash"],
                expectedDate: null,
                actualDate: null,
                notes: null,
                projectId,
                sortOrder: stages.length ? Math.max(...stages.map((s) => s.sortOrder)) + 1 : 1,
                createdAt: new Date(),
                updatedAt: new Date(),
              })
            }
          >
            Add Stage
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-md border p-3">
          <div className="text-xs text-muted-foreground">Expected Total</div>
          <div className="mt-1 text-lg font-semibold tabular-nums">₹{totals.expected.toFixed(2)}</div>
        </div>
        <div className="rounded-md border p-3">
          <div className="text-xs text-muted-foreground">Actual Received</div>
          <div className="mt-1 text-lg font-semibold tabular-nums">₹{totals.actual.toFixed(2)}</div>
        </div>
        <div className="rounded-md border p-3">
          <div className="text-xs text-muted-foreground">Balance</div>
          <div
            className={cn(
              "mt-1 text-lg font-semibold tabular-nums",
              totals.balance <= 0 ? "text-emerald-600" : "text-amber-600",
            )}
          >
            ₹{totals.balance.toFixed(2)}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table className="min-w-[1100px]">
          <TableHeader>
            <TableRow>
              <TableHead>Stage</TableHead>
              <TableHead>Scope</TableHead>
              <TableHead className="text-right">%</TableHead>
              <TableHead className="text-right">Expected</TableHead>
              <TableHead className="text-right">Bank</TableHead>
              <TableHead className="text-right">Cash</TableHead>
              <TableHead className="text-right">Actual Bank</TableHead>
              <TableHead className="text-right">Actual Cash</TableHead>
              <TableHead className="text-right">Actual Total</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stages.map((s) => {
              const expected = Number(money(s.expectedAmount));
              const actual = Number(money(s.actualBank)) + Number(money(s.actualCash));
              const bal = expected - actual;
              return (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.stageName}</TableCell>
                  <TableCell className="max-w-[420px] truncate">{s.scopeOfWork ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{s.percent ? String(s.percent) : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">₹{money(s.expectedAmount)}</TableCell>
                  <TableCell className="text-right tabular-nums">₹{money(s.expectedBank)}</TableCell>
                  <TableCell className="text-right tabular-nums">₹{money(s.expectedCash)}</TableCell>
                  <TableCell className="text-right tabular-nums">₹{money(s.actualBank)}</TableCell>
                  <TableCell className="text-right tabular-nums">₹{money(s.actualCash)}</TableCell>
                  <TableCell className="text-right tabular-nums">₹{actual.toFixed(2)}</TableCell>
                  <TableCell className={cn("text-right tabular-nums", bal <= 0 ? "text-emerald-600" : "")}>
                    ₹{bal.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setEditing(s)}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          startTransition(async () => {
                            try {
                              await deletePaymentStage(s.id, projectId);
                              toast.success("Stage deleted.");
                            } catch (e) {
                              toast.error(e instanceof Error ? e.message : "Delete failed.");
                            }
                          });
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {stages.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="py-10 text-center text-sm text-muted-foreground">
                  No schedule yet. Import your CSV or add stages manually.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => (!o ? setEditing(null) : null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing?.id === "new" ? "Add stage" : "Edit stage"}</DialogTitle>
          </DialogHeader>
          {editing ? (
            <form
              action={(fd) => {
                fd.set("projectId", projectId);
                if (editing.id !== "new") fd.set("id", editing.id);
                startTransition(async () => {
                  try {
                    await upsertPaymentStage(Object.fromEntries(fd.entries()));
                    toast.success("Saved.");
                    setEditing(null);
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Save failed.");
                  }
                });
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="space-y-2 text-sm sm:col-span-2">
                  <div className="text-muted-foreground">Stage name</div>
                  <Input name="stageName" defaultValue={editing.stageName} required />
                </label>
                <label className="space-y-2 text-sm sm:col-span-2">
                  <div className="text-muted-foreground">Scope of work</div>
                  <Textarea name="scopeOfWork" defaultValue={editing.scopeOfWork ?? ""} rows={2} />
                </label>
                <label className="space-y-2 text-sm">
                  <div className="text-muted-foreground">Percent</div>
                  <Input name="percent" type="number" inputMode="decimal" step="0.01" defaultValue={editing.percent ? String(editing.percent) : ""} />
                </label>
                <label className="space-y-2 text-sm">
                  <div className="text-muted-foreground">Sort order</div>
                  <Input name="sortOrder" type="number" inputMode="numeric" step="1" defaultValue={String(editing.sortOrder)} />
                </label>
              </div>

              <Separator />

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="space-y-2 text-sm">
                  <div className="text-muted-foreground">Expected total</div>
                  <Input name="expectedAmount" type="number" inputMode="decimal" step="0.01" defaultValue={money(editing.expectedAmount)} required />
                </label>
                <label className="space-y-2 text-sm">
                  <div className="text-muted-foreground">Expected date (optional)</div>
                  <Input name="expectedDate" type="date" defaultValue={editing.expectedDate ? editing.expectedDate.toISOString().slice(0, 10) : ""} />
                </label>
                <label className="space-y-2 text-sm">
                  <div className="text-muted-foreground">Expected bank</div>
                  <Input name="expectedBank" type="number" inputMode="decimal" step="0.01" defaultValue={money(editing.expectedBank)} />
                </label>
                <label className="space-y-2 text-sm">
                  <div className="text-muted-foreground">Expected cash</div>
                  <Input name="expectedCash" type="number" inputMode="decimal" step="0.01" defaultValue={money(editing.expectedCash)} />
                </label>
              </div>

              <Separator />

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="space-y-2 text-sm">
                  <div className="text-muted-foreground">Actual bank received</div>
                  <Input name="actualBank" type="number" inputMode="decimal" step="0.01" defaultValue={money(editing.actualBank)} />
                </label>
                <label className="space-y-2 text-sm">
                  <div className="text-muted-foreground">Actual cash received</div>
                  <Input name="actualCash" type="number" inputMode="decimal" step="0.01" defaultValue={money(editing.actualCash)} />
                </label>
                <label className="space-y-2 text-sm">
                  <div className="text-muted-foreground">Actual date (optional)</div>
                  <Input name="actualDate" type="date" defaultValue={editing.actualDate ? editing.actualDate.toISOString().slice(0, 10) : ""} />
                </label>
                <label className="space-y-2 text-sm">
                  <div className="text-muted-foreground">Notes (optional)</div>
                  <Input name="notes" defaultValue={editing.notes ?? ""} />
                </label>
              </div>

              <div className="flex items-center justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending ? "Saving…" : "Save"}
                </Button>
              </div>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
