"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatINR } from "@/lib/money";

type ProjectOption = { id: string; name: string };

type PreviewRow = {
  rowNumber: number;
  date: string;
  description: string;
  outgoing: number;
  modeRaw: string;
  categoryRaw: string;
  tds: number;
  reference: string;
  vendorGuess: string;
  errors: string[];
};

type PreviewResponse = {
  ok: boolean;
  dryRun: boolean;
  kind: "BILLS" | "PAYMENTS_MADE";
  totalRows: number;
  relevantRows: number;
  rows: PreviewRow[];
  errors: PreviewRow[];
  error?: string;
};

export function ImportPurchasesClient({ projects }: { projects: ProjectOption[] }) {
  const [file, setFile] = useState<File | null>(null);
  const [projectId, setProjectId] = useState<string>(projects[0]?.id ?? "");
  const [kind, setKind] = useState<"BILLS" | "PAYMENTS_MADE">("PAYMENTS_MADE");
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const canSubmit = !!file && !!projectId && !loading;

  const sampleRows = useMemo(() => preview?.rows ?? [], [preview]);
  const errorRows = useMemo(() => preview?.errors ?? [], [preview]);

  async function callApi({ dryRun }: { dryRun: boolean }) {
    if (!file) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("projectId", projectId);
      fd.set("kind", kind);
      if (dryRun) fd.set("dryRun", "1");

      const res = await fetch("/api/imports/purchases", { method: "POST", body: fd });
      const data = (await res.json()) as any;
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Import failed");
      }

      if (dryRun) {
        setPreview(data as PreviewResponse);
        toast.success(`Preview ready (${data.relevantRows} rows)`);
      } else {
        setPreview(null);
        toast.success(`Imported: ${data.created} created, ${data.skipped} skipped`);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Import failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Import CSV → Bills / Payments Made</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a cashbook CSV/TSV and let Probuild create Bills or Payments Made. Always preview before importing.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">1) Choose file + project</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <label className="space-y-2 text-sm">
            <div className="text-muted-foreground">CSV/TSV file</div>
            <Input
              type="file"
              accept=".csv,text/csv,text/tab-separated-values,.tsv"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>

          <label className="space-y-2 text-sm">
            <div className="text-muted-foreground">Project</div>
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2 text-sm">
            <div className="text-muted-foreground">Import as</div>
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={kind}
              onChange={(e) => setKind(e.target.value as any)}
            >
              <option value="PAYMENTS_MADE">Payments Made</option>
              <option value="BILLS">Bills</option>
            </select>
          </label>

          <div className="md:col-span-3 flex flex-wrap gap-2">
            <Button type="button" variant="secondary" disabled={!canSubmit} onClick={() => callApi({ dryRun: true })}>
              {loading ? "Working..." : "Preview"}
            </Button>
            <Button type="button" disabled={!canSubmit} onClick={() => callApi({ dryRun: false })}>
              {loading ? "Importing..." : "Import now"}
            </Button>
            <div className="text-xs text-muted-foreground self-center">
              Tip: the importer reads both comma-separated CSV and tab-separated exports.
            </div>
          </div>
        </CardContent>
      </Card>

      {preview ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">2) Preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Detected <span className="text-foreground">{preview.totalRows}</span> rows. Importer will use{" "}
              <span className="text-foreground">{preview.relevantRows}</span> rows for{" "}
              <span className="text-foreground">{preview.kind === "BILLS" ? "Bills" : "Payments Made"}</span>.
            </div>

            {errorRows.length > 0 ? (
              <div className="rounded-md border bg-muted/20 p-3 text-sm">
                <div className="font-medium">Rows with issues (first {errorRows.length})</div>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                  {errorRows.slice(0, 8).map((r) => (
                    <li key={r.rowNumber}>
                      Row {r.rowNumber}: {r.errors.join("; ")}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Vendor guess</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">TDS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sampleRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                        Nothing to preview.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sampleRows.map((r) => (
                      <TableRow key={r.rowNumber}>
                        <TableCell>{r.rowNumber}</TableCell>
                        <TableCell>{r.date.slice(0, 10)}</TableCell>
                        <TableCell className="max-w-[420px] truncate">{r.description}</TableCell>
                        <TableCell className="max-w-[260px] truncate">{r.vendorGuess || "-"}</TableCell>
                        <TableCell>{r.modeRaw || "-"}</TableCell>
                        <TableCell>{r.categoryRaw || "-"}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatINR(Number(r.outgoing || 0))}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatINR(Number(r.tds || 0))}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

