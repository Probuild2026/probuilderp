"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createDebitNote, deleteDebitNote } from "@/app/actions/purchase-invoices";

type DebitNote = {
  id: string;
  debitNoteNumber: string;
  date: string;
  reason: string;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
};

function formatINR(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);
}

export function DebitNoteSection({
  purchaseInvoiceId,
  initialNotes,
}: {
  purchaseInvoiceId: string;
  initialNotes: DebitNote[];
}) {
  const [notes, setNotes] = useState<DebitNote[]>(initialNotes);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ debitNoteNumber: "", date: today, reason: "", taxableValue: "", cgst: "", sgst: "", igst: "" });

  const total = (Number(form.taxableValue) || 0) + (Number(form.cgst) || 0) + (Number(form.sgst) || 0) + (Number(form.igst) || 0);

  async function handleCreate() {
    setError("");
    if (!form.debitNoteNumber.trim() || !form.reason.trim() || !form.date) {
      setError("Debit note number, date, and reason are required.");
      return;
    }
    setSaving(true);
    const result = await createDebitNote({
      purchaseInvoiceId,
      debitNoteNumber: form.debitNoteNumber.trim(),
      date: form.date,
      reason: form.reason.trim(),
      taxableValue: Number(form.taxableValue) || 0,
      cgst: Number(form.cgst) || 0,
      sgst: Number(form.sgst) || 0,
      igst: Number(form.igst) || 0,
      total,
    });
    setSaving(false);
    if (!result.ok) { setError(result.error.message); return; }
    setNotes((prev) => [
      ...prev,
      {
        id: result.data.id,
        debitNoteNumber: form.debitNoteNumber.trim(),
        date: form.date,
        reason: form.reason.trim(),
        taxableValue: Number(form.taxableValue) || 0,
        cgst: Number(form.cgst) || 0,
        sgst: Number(form.sgst) || 0,
        igst: Number(form.igst) || 0,
        total,
      },
    ]);
    setForm({ debitNoteNumber: "", date: today, reason: "", taxableValue: "", cgst: "", sgst: "", igst: "" });
    setOpen(false);
  }

  async function handleDelete(id: string) {
    const result = await deleteDebitNote({ id, purchaseInvoiceId });
    if (result.ok) setNotes((prev) => prev.filter((n) => n.id !== id));
  }

  return (
    <Card>
      <CardHeader className="border-b border-border/60">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">Debit Notes</CardTitle>
            {notes.length > 0 && <Badge variant="secondary">{notes.length}</Badge>}
          </div>
          <Button size="sm" variant="outline" onClick={() => setOpen((v) => !v)}>
            {open ? "Cancel" : "Raise Debit Note"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        {open && (
          <div className="rounded-[18px] border border-border/60 bg-muted/20 p-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Debit Note No.</Label>
                <Input placeholder="DN-001" value={form.debitNoteNumber} onChange={(e) => setForm((f) => ({ ...f, debitNoteNumber: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Date</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Reason</Label>
              <Input placeholder="Overbilling, material returned, quality rejection…" value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} />
            </div>
            <div className="grid gap-4 sm:grid-cols-4">
              <div className="space-y-1">
                <Label>Taxable value</Label>
                <Input type="number" min="0" step="0.01" placeholder="0.00" value={form.taxableValue} onChange={(e) => setForm((f) => ({ ...f, taxableValue: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>CGST</Label>
                <Input type="number" min="0" step="0.01" placeholder="0.00" value={form.cgst} onChange={(e) => setForm((f) => ({ ...f, cgst: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>SGST</Label>
                <Input type="number" min="0" step="0.01" placeholder="0.00" value={form.sgst} onChange={(e) => setForm((f) => ({ ...f, sgst: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>IGST</Label>
                <Input type="number" min="0" step="0.01" placeholder="0.00" value={form.igst} onChange={(e) => setForm((f) => ({ ...f, igst: e.target.value }))} />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">Total: <span className="font-semibold text-foreground">{formatINR(total)}</span></div>
              <Button onClick={handleCreate} disabled={saving}>{saving ? "Saving…" : "Create debit note"}</Button>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}

        {notes.length === 0 && !open ? (
          <p className="text-sm text-muted-foreground">No debit notes raised against this bill.</p>
        ) : notes.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Note No.</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {notes.map((note) => (
                <TableRow key={note.id}>
                  <TableCell className="font-medium">{note.debitNoteNumber}</TableCell>
                  <TableCell>{note.date}</TableCell>
                  <TableCell className="max-w-xs truncate">{note.reason}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatINR(note.total)}</TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" className="size-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(note.id)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : null}
      </CardContent>
    </Card>
  );
}
