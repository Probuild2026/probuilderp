"use client";

import { PaymentMode, PartnerRemunerationType } from "@prisma/client";
import { useRouter } from "next/navigation";
import { type FormEvent, type ReactNode, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  deletePartnerDrawing,
  deletePartnerRemuneration,
  deletePartnerTdsPayment,
  updatePartnerDrawing,
  updatePartnerRemuneration,
  updatePartnerTdsPayment,
} from "@/app/actions/partners";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PARTNER_DEFAULT_TDS_RATE, PARTNER_TDS_SECTION } from "@/lib/partner-finance";

type ProjectOption = { id: string; name: string };

type ActionError = {
  message: string;
  fieldErrors?: Record<string, string[]>;
};

type RemunerationEntry = {
  id: string;
  partnerId: string;
  projectId: string | null;
  date: string;
  type: PartnerRemunerationType;
  grossAmount: number;
  tdsRate: number;
  paymentMode: PaymentMode | null;
  paymentDate: string | null;
  note: string | null;
};

type DrawingEntry = {
  id: string;
  partnerId: string;
  projectId: string | null;
  date: string;
  amount: number;
  mode: PaymentMode;
  note: string | null;
};

type TdsPaymentEntry = {
  id: string;
  partnerId: string;
  fy: string;
  section: string;
  challanNo: string | null;
  periodFrom: string | null;
  periodTo: string | null;
  tdsPaidAmount: number;
  paymentDate: string;
  note: string | null;
};

const fieldLabels: Record<string, string> = {
  amount: "Amount",
  challanNo: "Challan number",
  date: "Date",
  fy: "Financial year",
  grossAmount: "Gross amount",
  mode: "Payment mode",
  note: "Note",
  paymentDate: "Payment date",
  paymentMode: "Payment mode",
  periodFrom: "Period from",
  periodTo: "Period to",
  projectId: "Project",
  section: "Section",
  tdsPaidAmount: "TDS paid amount",
  tdsRate: "TDS rate",
  type: "Type",
};

const paymentModes: Array<{ value: PaymentMode; label: string }> = [
  { value: PaymentMode.BANK_TRANSFER, label: "Bank transfer" },
  { value: PaymentMode.UPI, label: "UPI" },
  { value: PaymentMode.CASH, label: "Cash" },
  { value: PaymentMode.CHEQUE, label: "Cheque" },
];

function formatActionError(error: ActionError) {
  const firstField = Object.entries(error.fieldErrors ?? {}).find(([, messages]) => messages.length > 0);
  if (!firstField) return error.message;
  const [field, messages] = firstField;
  return `${fieldLabels[field] ?? field}: ${messages[0]}`;
}

function ActionButtons({ children }: { children: ReactNode }) {
  return <div className="flex items-center justify-end gap-2 whitespace-nowrap">{children}</div>;
}

export function PartnerRemunerationRowActions({
  entry,
  projects,
}: {
  entry: RemunerationEntry;
  projects: ProjectOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, startSaving] = useTransition();
  const [deleting, startDeleting] = useTransition();
  const [form, setForm] = useState(() => buildRemunerationForm(entry));

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startSaving(async () => {
      const result = await updatePartnerRemuneration({
        id: entry.id,
        partnerId: entry.partnerId,
        projectId: form.projectId || undefined,
        date: form.date,
        type: form.type,
        grossAmount: form.grossAmount,
        tdsRate: form.tdsRate,
        paymentMode: form.paymentMode || undefined,
        paymentDate: form.paymentDate || undefined,
        note: form.note,
      });

      if (!result.ok) {
        toast.error(formatActionError(result.error));
        return;
      }

      toast.success("Remuneration entry updated.");
      setOpen(false);
      router.refresh();
    });
  }

  function onDelete() {
    const ok = window.confirm(
      "Delete this remuneration entry?\n\nUse delete only for duplicate or accidental rows. TDS will be recalculated for the full financial year after deletion.",
    );
    if (!ok) return;

    startDeleting(async () => {
      const result = await deletePartnerRemuneration({ id: entry.id, partnerId: entry.partnerId });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success("Remuneration entry deleted.");
      router.refresh();
    });
  }

  function openEditor() {
    setForm(buildRemunerationForm(entry));
    setOpen(true);
  }

  return (
    <>
      <ActionButtons>
        <Button type="button" variant="outline" size="xs" disabled={saving || deleting} onClick={openEditor}>
          Edit
        </Button>
        <Button type="button" variant="destructive" size="xs" disabled={saving || deleting} onClick={onDelete}>
          Delete
        </Button>
      </ActionButtons>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit remuneration entry</DialogTitle>
            <DialogDescription>
              Use this when the date, amount, project, or payment details were entered wrongly. Saving will recalculate TDS for this partner&apos;s full financial year.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={submit}>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Date</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm((current) => ({ ...current, date: e.target.value }))} required />
              </div>
              <div>
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(value) => setForm((current) => ({ ...current, type: value as PartnerRemunerationType }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={PartnerRemunerationType.SALARY}>Salary</SelectItem>
                    <SelectItem value={PartnerRemunerationType.BONUS}>Bonus</SelectItem>
                    <SelectItem value={PartnerRemunerationType.COMMISSION}>Commission</SelectItem>
                    <SelectItem value={PartnerRemunerationType.OTHER}>Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label>Project (optional)</Label>
                <Select value={form.projectId || "__none"} onValueChange={(value) => setForm((current) => ({ ...current, projectId: value === "__none" ? "" : value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Not tagged to project</SelectItem>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Gross amount</Label>
                <Input inputMode="decimal" value={form.grossAmount} onChange={(e) => setForm((current) => ({ ...current, grossAmount: e.target.value }))} required />
              </div>
              <div>
                <Label>TDS rate %</Label>
                <Input inputMode="decimal" value={form.tdsRate} onChange={(e) => setForm((current) => ({ ...current, tdsRate: e.target.value }))} required />
              </div>
              <div>
                <Label>Payment mode (optional)</Label>
                <Select value={form.paymentMode || "__unpaid"} onValueChange={(value) => setForm((current) => ({ ...current, paymentMode: value === "__unpaid" ? "" : value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__unpaid">Unpaid</SelectItem>
                    {paymentModes.map((mode) => (
                      <SelectItem key={mode.value} value={mode.value}>
                        {mode.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Payment date (optional)</Label>
                <Input type="date" value={form.paymentDate} onChange={(e) => setForm((current) => ({ ...current, paymentDate: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Note</Label>
              <Textarea rows={3} value={form.note} onChange={(e) => setForm((current) => ({ ...current, note: e.target.value }))} />
            </div>
            <p className="rounded-md border px-3 py-2 text-xs text-muted-foreground">
              Leave TDS rate at {PARTNER_DEFAULT_TDS_RATE}% for normal 194T entries. If the entry is below threshold after recalculation, TDS will automatically become 0.
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function PartnerDrawingRowActions({ entry, projects }: { entry: DrawingEntry; projects: ProjectOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, startSaving] = useTransition();
  const [deleting, startDeleting] = useTransition();
  const [form, setForm] = useState(() => buildDrawingForm(entry));

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startSaving(async () => {
      const result = await updatePartnerDrawing({
        id: entry.id,
        partnerId: entry.partnerId,
        projectId: form.projectId || undefined,
        date: form.date,
        amount: form.amount,
        mode: form.mode,
        note: form.note,
      });

      if (!result.ok) {
        toast.error(formatActionError(result.error));
        return;
      }

      toast.success("Drawing entry updated.");
      setOpen(false);
      router.refresh();
    });
  }

  function onDelete() {
    const ok = window.confirm(
      "Delete this drawing entry?\n\nUse delete only for duplicate or accidental rows. This removes the row from the partner balance immediately.",
    );
    if (!ok) return;

    startDeleting(async () => {
      const result = await deletePartnerDrawing({ id: entry.id, partnerId: entry.partnerId });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success("Drawing entry deleted.");
      router.refresh();
    });
  }

  function openEditor() {
    setForm(buildDrawingForm(entry));
    setOpen(true);
  }

  return (
    <>
      <ActionButtons>
        <Button type="button" variant="outline" size="xs" disabled={saving || deleting} onClick={openEditor}>
          Edit
        </Button>
        <Button type="button" variant="destructive" size="xs" disabled={saving || deleting} onClick={onDelete}>
          Delete
        </Button>
      </ActionButtons>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit drawing entry</DialogTitle>
            <DialogDescription>
              Use this when the amount, payment mode, or project tag was entered wrongly. Delete only duplicate or accidental rows.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={submit}>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Date</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm((current) => ({ ...current, date: e.target.value }))} required />
              </div>
              <div>
                <Label>Amount</Label>
                <Input inputMode="decimal" value={form.amount} onChange={(e) => setForm((current) => ({ ...current, amount: e.target.value }))} required />
              </div>
              <div>
                <Label>Payment mode</Label>
                <Select value={form.mode} onValueChange={(value) => setForm((current) => ({ ...current, mode: value as PaymentMode }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={PaymentMode.CASH}>Cash</SelectItem>
                    <SelectItem value={PaymentMode.BANK_TRANSFER}>Bank transfer</SelectItem>
                    <SelectItem value={PaymentMode.UPI}>UPI</SelectItem>
                    <SelectItem value={PaymentMode.CHEQUE}>Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Project (optional)</Label>
                <Select value={form.projectId || "__none"} onValueChange={(value) => setForm((current) => ({ ...current, projectId: value === "__none" ? "" : value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Not tagged to project</SelectItem>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Note</Label>
              <Textarea rows={3} value={form.note} onChange={(e) => setForm((current) => ({ ...current, note: e.target.value }))} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function PartnerTdsPaymentRowActions({ entry }: { entry: TdsPaymentEntry }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, startSaving] = useTransition();
  const [deleting, startDeleting] = useTransition();
  const [form, setForm] = useState(() => buildTdsPaymentForm(entry));

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startSaving(async () => {
      const result = await updatePartnerTdsPayment({
        id: entry.id,
        partnerId: entry.partnerId,
        fy: form.fy,
        section: form.section || PARTNER_TDS_SECTION,
        challanNo: form.challanNo,
        periodFrom: form.periodFrom || undefined,
        periodTo: form.periodTo || undefined,
        tdsPaidAmount: form.tdsPaidAmount,
        paymentDate: form.paymentDate,
        note: form.note,
      });

      if (!result.ok) {
        toast.error(formatActionError(result.error));
        return;
      }

      toast.success("TDS payment updated.");
      setOpen(false);
      router.refresh();
    });
  }

  function onDelete() {
    const ok = window.confirm(
      "Delete this TDS payment entry?\n\nUse delete only for duplicate or accidental rows. This will reduce the deposited TDS total for the selected financial year.",
    );
    if (!ok) return;

    startDeleting(async () => {
      const result = await deletePartnerTdsPayment({ id: entry.id, partnerId: entry.partnerId });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success("TDS payment entry deleted.");
      router.refresh();
    });
  }

  function openEditor() {
    setForm(buildTdsPaymentForm(entry));
    setOpen(true);
  }

  return (
    <>
      <ActionButtons>
        <Button type="button" variant="outline" size="xs" disabled={saving || deleting} onClick={openEditor}>
          Edit
        </Button>
        <Button type="button" variant="destructive" size="xs" disabled={saving || deleting} onClick={onDelete}>
          Delete
        </Button>
      </ActionButtons>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit TDS payment</DialogTitle>
            <DialogDescription>
              Use this when the challan details, period, or deposited amount were entered wrongly. Delete only duplicate or accidental rows.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={submit}>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Financial year</Label>
                <Input value={form.fy} onChange={(e) => setForm((current) => ({ ...current, fy: e.target.value }))} required />
              </div>
              <div>
                <Label>Section</Label>
                <Input value={form.section} onChange={(e) => setForm((current) => ({ ...current, section: e.target.value }))} required />
              </div>
              <div>
                <Label>Challan number (optional)</Label>
                <Input value={form.challanNo} onChange={(e) => setForm((current) => ({ ...current, challanNo: e.target.value }))} />
              </div>
              <div>
                <Label>TDS paid amount</Label>
                <Input inputMode="decimal" value={form.tdsPaidAmount} onChange={(e) => setForm((current) => ({ ...current, tdsPaidAmount: e.target.value }))} required />
              </div>
              <div>
                <Label>Period from (optional)</Label>
                <Input type="date" value={form.periodFrom} onChange={(e) => setForm((current) => ({ ...current, periodFrom: e.target.value }))} />
              </div>
              <div>
                <Label>Period to (optional)</Label>
                <Input type="date" value={form.periodTo} onChange={(e) => setForm((current) => ({ ...current, periodTo: e.target.value }))} />
              </div>
              <div className="sm:col-span-2">
                <Label>Payment date</Label>
                <Input type="date" value={form.paymentDate} onChange={(e) => setForm((current) => ({ ...current, paymentDate: e.target.value }))} required />
              </div>
            </div>
            <div>
              <Label>Note</Label>
              <Textarea rows={3} value={form.note} onChange={(e) => setForm((current) => ({ ...current, note: e.target.value }))} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function buildRemunerationForm(entry: RemunerationEntry) {
  return {
    projectId: entry.projectId ?? "",
    date: entry.date,
    type: entry.type,
    grossAmount: String(entry.grossAmount),
    tdsRate: String(entry.tdsRate || PARTNER_DEFAULT_TDS_RATE),
    paymentMode: entry.paymentMode ?? "",
    paymentDate: entry.paymentDate ?? "",
    note: entry.note ?? "",
  };
}

function buildDrawingForm(entry: DrawingEntry) {
  return {
    projectId: entry.projectId ?? "",
    date: entry.date,
    amount: String(entry.amount),
    mode: entry.mode,
    note: entry.note ?? "",
  };
}

function buildTdsPaymentForm(entry: TdsPaymentEntry) {
  return {
    fy: entry.fy,
    section: entry.section || PARTNER_TDS_SECTION,
    challanNo: entry.challanNo ?? "",
    periodFrom: entry.periodFrom ?? "",
    periodTo: entry.periodTo ?? "",
    tdsPaidAmount: String(entry.tdsPaidAmount),
    paymentDate: entry.paymentDate,
    note: entry.note ?? "",
  };
}
