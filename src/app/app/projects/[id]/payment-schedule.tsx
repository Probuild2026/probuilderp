"use client";

import { useMemo, useState, useTransition } from "react";
import { Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { formatINR } from "@/lib/money";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

import { deletePaymentStage, importPaymentScheduleCsv, upsertPaymentStage } from "./actions";

type Stage = {
  id: string;
  stageName: string;
  scopeOfWork: string | null;
  percent: number | null;
  expectedAmount: number;
  expectedBank: number;
  expectedCash: number;
  actualBank: number;
  actualCash: number;
  expectedDate: string;
  actualDate: string;
  notes: string;
  sortOrder: number;
};

function money(v: number) {
  return v.toFixed(2);
}

function displayDate(v: string) {
  if (!v) return "";
  const parts = v.split("-");
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return v;
}

export function PaymentSchedule({
  projectId,
  stages,
  receiptTotals,
}: {
  projectId: string;
  stages: Stage[];
  receiptTotals: {
    bank: number;
    cash: number;
  };
}) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<Stage | null>(null);
  const [details, setDetails] = useState<Stage | null>(null);

  const totals = useMemo(() => {
    let expBank = 0;
    let expCash = 0;
    for (const s of stages) {
      expBank += s.expectedBank;
      expCash += s.expectedCash;
    }
    return {
      expectedBank: expBank,
      expectedCash: expCash,
      actualBank: receiptTotals.bank,
      actualCash: receiptTotals.cash,
      pendingBank: expBank - receiptTotals.bank,
      pendingCash: expCash - receiptTotals.cash,
      excessBank: Math.max(0, receiptTotals.bank - expBank),
      excessCash: Math.max(0, receiptTotals.cash - expCash),
    };
  }, [receiptTotals.bank, receiptTotals.cash, stages]);

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
                stageName: "",
                scopeOfWork: null,
                percent: null,
                expectedAmount: 0,
                expectedBank: 0,
                expectedCash: 0,
                actualBank: 0,
                actualCash: 0,
                expectedDate: "",
                actualDate: "",
                notes: "",
                sortOrder: stages.length ? Math.max(...stages.map((s) => s.sortOrder)) + 1 : 1,
              })
            }
          >
            Add Stage
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-md border p-3">
          <div className="text-xs text-muted-foreground">Expected Total (Bank)</div>
          <div className="mt-1 text-lg font-semibold tabular-nums">{formatINR(totals.expectedBank)}</div>
        </div>
        <div className="rounded-md border p-3">
          <div className="text-xs text-muted-foreground">Expected Total (Cash)</div>
          <div className="mt-1 text-lg font-semibold tabular-nums">{formatINR(totals.expectedCash)}</div>
        </div>
        <div className="rounded-md border p-3">
          <div
            className={cn("mt-1 text-lg font-semibold tabular-nums", totals.pendingBank <= 0 ? "text-emerald-600" : "text-amber-600")}
          >
            <div className="text-xs text-muted-foreground">Pending (Bank)</div>
            <div className="mt-1 text-lg font-semibold tabular-nums">{formatINR(totals.pendingBank)}</div>
          </div>
        </div>
        <div className="rounded-md border p-3">
          <div className="text-xs text-muted-foreground">Actual Bank Received</div>
          <div className="mt-1 text-lg font-semibold tabular-nums">{formatINR(totals.actualBank)}</div>
        </div>
        <div className="rounded-md border p-3">
          <div className="text-xs text-muted-foreground">Actual Cash Received</div>
          <div className="mt-1 text-lg font-semibold tabular-nums">{formatINR(totals.actualCash)}</div>
        </div>
        <div className="rounded-md border p-3">
          <div className="text-xs text-muted-foreground">Pending (Cash)</div>
          <div className={cn("mt-1 text-lg font-semibold tabular-nums", totals.pendingCash <= 0 ? "text-emerald-600" : "text-amber-600")}>
            {formatINR(totals.pendingCash)}
          </div>
        </div>
      </div>

      {(totals.excessBank > 0 || totals.excessCash > 0) && (
        <div className="text-xs text-amber-600">
          Excess collected: Bank {formatINR(totals.excessBank)} • Cash {formatINR(totals.excessCash)}
        </div>
      )}

      <Tabs defaultValue="summary">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="full">Full breakdown</TabsTrigger>
          </TabsList>
          <div
            className="inline-flex items-center gap-1 text-xs text-muted-foreground"
            title="On mobile, stages show as cards (no side scrolling)."
          >
            <Info className="size-3.5" />
            <span className="hidden sm:inline">Mobile cards view available</span>
          </div>
        </div>

        <TabsContent value="summary">
          <div className="space-y-2 md:hidden">
            {stages.map((s) => {
              const pendingBank = s.expectedBank - s.actualBank;
              const pendingCash = s.expectedCash - s.actualCash;
              const excessBank = Math.max(0, s.actualBank - s.expectedBank);
              const excessCash = Math.max(0, s.actualCash - s.expectedCash);
              return (
                <div key={s.id} className="rounded-md border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">{s.stageName}</div>
                      <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{s.scopeOfWork ?? "—"}</div>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">{s.percent != null ? `${s.percent}%` : "—"}</div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded border p-2">
                      <div className="text-muted-foreground">Contract (Bank)</div>
                      <div className="mt-0.5 font-medium tabular-nums">{formatINR(s.expectedBank)}</div>
                    </div>
                    <div className="rounded border p-2">
                      <div className="text-muted-foreground">Contract (Cash)</div>
                      <div className="mt-0.5 font-medium tabular-nums">{formatINR(s.expectedCash)}</div>
                    </div>
                    <div className="rounded border p-2">
                      <div className="text-muted-foreground">Recvd (Bank)</div>
                      <div className="mt-0.5 font-medium tabular-nums">{formatINR(s.actualBank)}</div>
                    </div>
                    <div className="rounded border p-2">
                      <div className="text-muted-foreground">Recvd (Cash)</div>
                      <div className="mt-0.5 font-medium tabular-nums">{formatINR(s.actualCash)}</div>
                    </div>
                    <div className="rounded border p-2">
                      <div className="text-muted-foreground">Pending (Bank)</div>
                      <div className={cn("mt-0.5 font-medium tabular-nums", pendingBank <= 0 ? "text-emerald-600" : "text-amber-600")}>
                        {formatINR(pendingBank)}
                      </div>
                    </div>
                    <div className="rounded border p-2">
                      <div className="text-muted-foreground">Pending (Cash)</div>
                      <div className={cn("mt-0.5 font-medium tabular-nums", pendingCash <= 0 ? "text-emerald-600" : "text-amber-600")}>
                        {formatINR(pendingCash)}
                      </div>
                    </div>
                    {(excessBank > 0 || excessCash > 0) && (
                      <div className="col-span-2 text-xs text-amber-600">
                        Excess: Bank {formatINR(excessBank)} • Cash {formatINR(excessCash)}
                      </div>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => setDetails(s)}>
                      Details
                    </Button>
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
                </div>
              );
            })}
            {stages.length === 0 ? (
              <div className="rounded-md border py-10 text-center text-sm text-muted-foreground">
                No schedule yet. Import your CSV or add stages manually.
              </div>
            ) : null}
          </div>

          <div className="relative hidden overflow-x-auto rounded-md border md:block">
            <div className="max-h-[60vh] overflow-auto">
            <Table className="min-w-[1180px] table-fixed text-xs">
              <TableHeader className="sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
                <TableRow>
                  <TableHead className="stage-col sticky left-0 z-30 w-[220px] max-w-[220px] bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
                    Stage
                  </TableHead>
                  <TableHead className="w-[56px] whitespace-nowrap text-right">%</TableHead>
                  <TableHead className="amount-col w-[100px] whitespace-nowrap text-right" title="Contract Bank">
                    C.Bank
                  </TableHead>
                  <TableHead className="amount-col w-[100px] whitespace-nowrap text-right" title="Contract Cash">
                    C.Cash
                  </TableHead>
                  <TableHead className="amount-col w-[100px] whitespace-nowrap text-right" title="Received Bank">
                    R.Bank
                  </TableHead>
                  <TableHead className="amount-col w-[100px] whitespace-nowrap text-right" title="Received Cash">
                    R.Cash
                  </TableHead>
                  <TableHead className="amount-col w-[100px] whitespace-nowrap text-right" title="Pending Bank">
                    P.Bank
                  </TableHead>
                  <TableHead className="amount-col w-[100px] whitespace-nowrap text-right" title="Pending Cash">
                    P.Cash
                  </TableHead>
                  <TableHead className="amount-col w-[100px] whitespace-nowrap text-right" title="Excess Bank">
                    Ex.Bank
                  </TableHead>
                  <TableHead className="amount-col w-[100px] whitespace-nowrap text-right" title="Excess Cash">
                    Ex.Cash
                  </TableHead>
                  <TableHead className="actions-col sticky right-0 z-30 bg-background/95 text-right backdrop-blur supports-[backdrop-filter]:bg-background/70">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stages.map((s) => {
                  const pendingBank = s.expectedBank - s.actualBank;
                  const pendingCash = s.expectedCash - s.actualCash;
                  const excessBank = Math.max(0, s.actualBank - s.expectedBank);
                  const excessCash = Math.max(0, s.actualCash - s.expectedCash);
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="stage-col sticky left-0 z-20 w-[220px] max-w-[220px] bg-background align-top">
                        <div className="truncate text-sm font-medium leading-4" title={s.stageName}>
                          {s.stageName}
                        </div>
                        <div className="mt-1 line-clamp-2 overflow-hidden text-ellipsis text-[11px] leading-4 text-muted-foreground" title={s.scopeOfWork ?? "—"}>
                          {s.scopeOfWork ?? "—"}
                        </div>
                      </TableCell>
                      <TableCell className="w-[56px] whitespace-nowrap text-right tabular-nums">{s.percent != null ? String(s.percent) : "—"}</TableCell>
                      <TableCell className="amount-col w-[100px] whitespace-nowrap text-right tabular-nums">{formatINR(s.expectedBank)}</TableCell>
                      <TableCell className="amount-col w-[100px] whitespace-nowrap text-right tabular-nums">{formatINR(s.expectedCash)}</TableCell>
                      <TableCell className="amount-col w-[100px] whitespace-nowrap text-right tabular-nums">{formatINR(s.actualBank)}</TableCell>
                      <TableCell className="amount-col w-[100px] whitespace-nowrap text-right tabular-nums">{formatINR(s.actualCash)}</TableCell>
                      <TableCell className={cn("amount-col w-[100px] whitespace-nowrap text-right tabular-nums", pendingBank <= 0 ? "text-emerald-600" : "text-amber-600")}>
                        {formatINR(pendingBank)}
                      </TableCell>
                      <TableCell className={cn("amount-col w-[100px] whitespace-nowrap text-right tabular-nums", pendingCash <= 0 ? "text-emerald-600" : "text-amber-600")}>
                        {formatINR(pendingCash)}
                      </TableCell>
                      <TableCell className="amount-col w-[100px] whitespace-nowrap text-right tabular-nums">{formatINR(excessBank)}</TableCell>
                      <TableCell className="amount-col w-[100px] whitespace-nowrap text-right tabular-nums">{formatINR(excessCash)}</TableCell>
                      <TableCell className="actions-col sticky right-0 z-20 w-[170px] bg-background text-right">
                        <div className="inline-flex flex-wrap justify-end gap-1">
                          <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => setDetails(s)}>
                            Details
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => setEditing(s)}>
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-7 px-2 text-[11px]"
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
                    <TableCell colSpan={13} className="py-10 text-center text-sm text-muted-foreground">
                      No schedule yet. Import your CSV or add stages manually.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="full">
          <div className="rounded-md border p-3 text-sm text-muted-foreground md:hidden">
            Full breakdown is best viewed on desktop.
          </div>
          <div className="relative hidden overflow-x-auto rounded-md border md:block">
            <div className="max-h-[60vh] overflow-auto">
            <Table className="min-w-[1320px] table-fixed text-xs">
              <TableHeader className="sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
                <TableRow>
                  <TableHead className="stage-col sticky left-0 z-30 w-[180px] max-w-[180px] bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
                    Stage
                  </TableHead>
                  <TableHead className="w-[220px]">Scope</TableHead>
                  <TableHead className="w-[56px] whitespace-nowrap text-right">%</TableHead>
                  <TableHead className="amount-col w-[95px] whitespace-nowrap text-right" title="Contract Bank">
                    C.Bank
                  </TableHead>
                  <TableHead className="amount-col w-[95px] whitespace-nowrap text-right" title="Contract Cash">
                    C.Cash
                  </TableHead>
                  <TableHead className="amount-col w-[95px] whitespace-nowrap text-right" title="Received Bank">
                    R.Bank
                  </TableHead>
                  <TableHead className="amount-col w-[95px] whitespace-nowrap text-right" title="Received Cash">
                    R.Cash
                  </TableHead>
                  <TableHead className="amount-col w-[95px] whitespace-nowrap text-right" title="Pending Bank">
                    P.Bank
                  </TableHead>
                  <TableHead className="amount-col w-[95px] whitespace-nowrap text-right" title="Pending Cash">
                    P.Cash
                  </TableHead>
                  <TableHead className="amount-col w-[95px] whitespace-nowrap text-right" title="Excess Bank">
                    Ex.Bank
                  </TableHead>
                  <TableHead className="amount-col w-[95px] whitespace-nowrap text-right" title="Excess Cash">
                    Ex.Cash
                  </TableHead>
                  <TableHead className="w-[95px] whitespace-nowrap text-right">Exp Date</TableHead>
                  <TableHead className="actions-col sticky right-0 z-30 bg-background/95 text-right backdrop-blur supports-[backdrop-filter]:bg-background/70">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stages.map((s) => {
                  const pendingBank = s.expectedBank - s.actualBank;
                  const pendingCash = s.expectedCash - s.actualCash;
                  const excessBank = Math.max(0, s.actualBank - s.expectedBank);
                  const excessCash = Math.max(0, s.actualCash - s.expectedCash);
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="stage-col sticky left-0 z-20 w-[180px] max-w-[180px] bg-background align-top">
                        <div className="break-words text-sm font-medium leading-4">{s.stageName}</div>
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate text-[11px] leading-4 text-muted-foreground" title={s.scopeOfWork ?? "—"}>
                        {s.scopeOfWork ?? "—"}
                      </TableCell>
                      <TableCell className="w-[56px] whitespace-nowrap text-right tabular-nums">{s.percent != null ? String(s.percent) : "—"}</TableCell>
                      <TableCell className="amount-col w-[95px] whitespace-nowrap text-right tabular-nums">{formatINR(s.expectedBank)}</TableCell>
                      <TableCell className="amount-col w-[95px] whitespace-nowrap text-right tabular-nums">{formatINR(s.expectedCash)}</TableCell>
                      <TableCell className="amount-col w-[95px] whitespace-nowrap text-right tabular-nums">{formatINR(s.actualBank)}</TableCell>
                      <TableCell className="amount-col w-[95px] whitespace-nowrap text-right tabular-nums">{formatINR(s.actualCash)}</TableCell>
                      <TableCell className={cn("amount-col w-[95px] whitespace-nowrap text-right tabular-nums", pendingBank <= 0 ? "text-emerald-600" : "text-amber-600")}>
                        {formatINR(pendingBank)}
                      </TableCell>
                      <TableCell className={cn("amount-col w-[95px] whitespace-nowrap text-right tabular-nums", pendingCash <= 0 ? "text-emerald-600" : "text-amber-600")}>
                        {formatINR(pendingCash)}
                      </TableCell>
                      <TableCell className="amount-col w-[95px] whitespace-nowrap text-right tabular-nums">{formatINR(excessBank)}</TableCell>
                      <TableCell className="amount-col w-[95px] whitespace-nowrap text-right tabular-nums">{formatINR(excessCash)}</TableCell>
                      <TableCell className="w-[95px] whitespace-nowrap text-right tabular-nums">{displayDate(s.expectedDate) || "—"}</TableCell>
                      <TableCell className="actions-col sticky right-0 z-20 w-[140px] bg-background text-right">
                        <div className="inline-flex gap-1">
                          <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => setEditing(s)}>
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-7 px-2 text-[11px]"
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
                    <TableCell colSpan={13} className="py-10 text-center text-sm text-muted-foreground">
                      No schedule yet. Import your CSV or add stages manually.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={!!details} onOpenChange={(o) => (!o ? setDetails(null) : null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Stage details</DialogTitle>
          </DialogHeader>
          {details ? (
            <div className="space-y-4 text-sm">
              <div>
                <div className="font-medium">{details.stageName}</div>
                <div className="mt-1 text-muted-foreground">{details.scopeOfWork ?? "—"}</div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">Expected bank</div>
                  <div className="mt-1 font-semibold tabular-nums">{formatINR(details.expectedBank)}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">Expected cash</div>
                  <div className="mt-1 font-semibold tabular-nums">{formatINR(details.expectedCash)}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">Actual bank</div>
                  <div className="mt-1 font-semibold tabular-nums">{formatINR(details.actualBank)}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">Actual cash</div>
                  <div className="mt-1 font-semibold tabular-nums">{formatINR(details.actualCash)}</div>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">Pending bank</div>
                  <div
                    className={cn(
                      "mt-1 font-semibold tabular-nums",
                      details.expectedBank - details.actualBank <= 0 ? "text-emerald-600" : "text-amber-600",
                    )}
                  >
                    {formatINR(details.expectedBank - details.actualBank)}
                  </div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">Pending cash</div>
                  <div
                    className={cn(
                      "mt-1 font-semibold tabular-nums",
                      details.expectedCash - details.actualCash <= 0 ? "text-emerald-600" : "text-amber-600",
                    )}
                  >
                    {formatINR(details.expectedCash - details.actualCash)}
                  </div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">Excess bank</div>
                  <div className="mt-1 font-semibold tabular-nums">{formatINR(Math.max(0, details.actualBank - details.expectedBank))}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">Excess cash</div>
                  <div className="mt-1 font-semibold tabular-nums">{formatINR(Math.max(0, details.actualCash - details.expectedCash))}</div>
                </div>
              </div>
              {(details.expectedDate || details.actualDate || details.notes) && (
                <div className="space-y-2">
                  {details.expectedDate ? (
                    <div className="text-muted-foreground">Expected date: {displayDate(details.expectedDate)}</div>
                  ) : null}
                  {details.actualDate ? (
                    <div className="text-muted-foreground">Actual date: {displayDate(details.actualDate)}</div>
                  ) : null}
                  {details.notes ? <div className="text-muted-foreground">Notes: {details.notes}</div> : null}
                </div>
              )}
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => setDetails(null)}>
                  Close
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

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
                  <Input
                    name="percent"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    defaultValue={editing.percent != null ? String(editing.percent) : ""}
                  />
                </label>
                <label className="space-y-2 text-sm">
                  <div className="text-muted-foreground">Sort order</div>
                  <Input name="sortOrder" type="number" inputMode="numeric" step="1" defaultValue={String(editing.sortOrder)} />
                </label>
              </div>

              <Separator />

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="space-y-2 text-sm">
                  <div className="text-muted-foreground">Expected date (optional)</div>
                  <Input name="expectedDate" placeholder="DD/MM/YYYY" defaultValue={displayDate(editing.expectedDate)} />
                  <div className="text-[11px] text-muted-foreground">Use DD/MM/YYYY</div>
                </label>
                <label className="space-y-2 text-sm">
                  <div className="text-muted-foreground">Expected bank</div>
                  <Input
                    name="expectedBank"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    defaultValue={money(editing.expectedBank)}
                    required
                  />
                  <div className="text-[11px] text-muted-foreground">Preview: {formatINR(editing.expectedBank)}</div>
                </label>
                <label className="space-y-2 text-sm">
                  <div className="text-muted-foreground">Expected cash</div>
                  <Input
                    name="expectedCash"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    defaultValue={money(editing.expectedCash)}
                    required
                  />
                  <div className="text-[11px] text-muted-foreground">Preview: {formatINR(editing.expectedCash)}</div>
                </label>
              </div>

              <Separator />

              <div className="rounded-md border p-3 text-xs text-muted-foreground">
                Expected total = Expected bank + Expected cash.
              </div>

              <div className="rounded-md border p-3 text-xs text-muted-foreground">
                Actual Bank/Cash values are calculated from Receipts tagged to this stage.
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="space-y-2 text-sm">
                  <div className="text-muted-foreground">Actual date (optional)</div>
                  <Input name="actualDate" placeholder="DD/MM/YYYY" defaultValue={displayDate(editing.actualDate)} />
                  <div className="text-[11px] text-muted-foreground">Use DD/MM/YYYY</div>
                </label>
                <label className="space-y-2 text-sm">
                  <div className="text-muted-foreground">Notes (optional)</div>
                  <Input name="notes" defaultValue={editing.notes} />
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
