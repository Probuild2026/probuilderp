"use client";

import { PaymentMode, PartnerRemunerationType } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  createPartnerDrawing,
  createPartnerRemuneration,
  createPartnerTdsPayment,
  upsertProjectProfitAllocation,
} from "@/app/actions/partners";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PARTNER_DEFAULT_TDS_RATE, PARTNER_TDS_SECTION } from "@/lib/partner-finance";
import { formatINR } from "@/lib/money";

type ProjectOption = { id: string; name: string };

export function PartnerEntryForms({
  partnerId,
  fy,
  projects,
}: {
  partnerId: string;
  fy: string;
  projects: ProjectOption[];
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <AddRemunerationCard partnerId={partnerId} fy={fy} projects={projects} />
      <AddDrawingCard partnerId={partnerId} projects={projects} />
      <AddTdsPaymentCard partnerId={partnerId} fy={fy} />
      <ProjectProfitAllocationCard fy={fy} projects={projects} />
    </div>
  );
}

function AddRemunerationCard({
  partnerId,
  fy,
  projects,
}: {
  partnerId: string;
  fy: string;
  projects: ProjectOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<{
    projectId: string;
    date: string;
    type: PartnerRemunerationType;
    grossAmount: string;
    tdsRate: string;
    paymentMode: string;
    paymentDate: string;
    note: string;
  }>({
    projectId: "",
    date: "",
    type: PartnerRemunerationType.SALARY,
    grossAmount: "",
    tdsRate: String(PARTNER_DEFAULT_TDS_RATE),
    paymentMode: "",
    paymentDate: "",
    note: "",
  });
  const preview = useMemo(() => {
    const gross = Number(form.grossAmount || 0);
    const rate = Number(form.tdsRate || PARTNER_DEFAULT_TDS_RATE);
    if (!Number.isFinite(gross) || gross <= 0 || !Number.isFinite(rate) || rate < 0) return null;
    const tds = (gross * rate) / 100;
    return { gross, tds, net: gross - tds };
  }, [form.grossAmount, form.tdsRate]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await createPartnerRemuneration({
        partnerId,
        projectId: form.projectId || undefined,
        date: form.date,
        type: form.type,
        grossAmount: form.grossAmount,
        tdsRate: form.tdsRate,
        paymentMode: form.paymentMode || undefined,
        paymentDate: form.paymentDate || undefined,
        note: form.note,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("Remuneration recorded.");
      setForm((prev) => ({ ...prev, date: "", grossAmount: "", paymentDate: "", note: "" }));
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add remuneration</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-3" onSubmit={submit}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Date</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} required />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(value) => setForm((f) => ({ ...f, type: value as PartnerRemunerationType }))}>
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
              <Select value={form.projectId || "__none"} onValueChange={(value) => setForm((f) => ({ ...f, projectId: value === "__none" ? "" : value }))}>
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
              <Input inputMode="decimal" value={form.grossAmount} onChange={(e) => setForm((f) => ({ ...f, grossAmount: e.target.value }))} required />
            </div>
            <div>
              <Label>TDS rate %</Label>
              <Input inputMode="decimal" value={form.tdsRate} onChange={(e) => setForm((f) => ({ ...f, tdsRate: e.target.value }))} />
            </div>
            <div>
              <Label>Payment mode (optional)</Label>
              <Select value={form.paymentMode || "__unpaid"} onValueChange={(value) => setForm((f) => ({ ...f, paymentMode: value === "__unpaid" ? "" : value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__unpaid">Unpaid</SelectItem>
                  <SelectItem value={PaymentMode.BANK_TRANSFER}>Bank transfer</SelectItem>
                  <SelectItem value={PaymentMode.UPI}>UPI</SelectItem>
                  <SelectItem value={PaymentMode.CASH}>Cash</SelectItem>
                  <SelectItem value={PaymentMode.CHEQUE}>Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Payment date (optional)</Label>
              <Input type="date" value={form.paymentDate} onChange={(e) => setForm((f) => ({ ...f, paymentDate: e.target.value }))} />
            </div>
          </div>
          <div>
            <Label>Note</Label>
            <Textarea rows={2} value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
          </div>
          <div className="rounded-md border p-2 text-xs text-muted-foreground">
            {preview
              ? `${PARTNER_TDS_SECTION} preview — Gross ${formatINR(preview.gross)}, TDS ${formatINR(preview.tds)}, Net ${formatINR(preview.net)}`
              : `TDS is auto-checked against ₹20,000 FY threshold (${fy}).`}
          </div>
          <Button type="submit" disabled={pending}>{pending ? "Saving..." : "Save remuneration"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function AddDrawingCard({
  partnerId,
  projects,
}: {
  partnerId: string;
  projects: ProjectOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<{
    projectId: string;
    date: string;
    amount: string;
    mode: PaymentMode;
    note: string;
  }>({
    projectId: "",
    date: "",
    amount: "",
    mode: PaymentMode.CASH,
    note: "",
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await createPartnerDrawing({
        partnerId,
        projectId: form.projectId || undefined,
        date: form.date,
        amount: form.amount,
        mode: form.mode,
        note: form.note,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("Drawing recorded.");
      setForm((prev) => ({ ...prev, date: "", amount: "", note: "" }));
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add drawing</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-3" onSubmit={submit}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Date</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} required />
            </div>
            <div>
              <Label>Amount</Label>
              <Input inputMode="decimal" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} required />
            </div>
            <div>
              <Label>Mode</Label>
              <Select value={form.mode} onValueChange={(value) => setForm((f) => ({ ...f, mode: value as PaymentMode }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={PaymentMode.CASH}>Cash</SelectItem>
                  <SelectItem value={PaymentMode.BANK_TRANSFER}>Bank transfer</SelectItem>
                  <SelectItem value={PaymentMode.UPI}>UPI</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Project (optional)</Label>
              <Select value={form.projectId || "__none"} onValueChange={(value) => setForm((f) => ({ ...f, projectId: value === "__none" ? "" : value }))}>
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
            <Textarea rows={2} value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
          </div>
          <p className="text-xs text-muted-foreground">Drawings are recorded without TDS and are adjusted against partner profit share.</p>
          <Button type="submit" disabled={pending}>{pending ? "Saving..." : "Save drawing"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function AddTdsPaymentCard({ partnerId, fy }: { partnerId: string; fy: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    fy,
    section: PARTNER_TDS_SECTION,
    challanNo: "",
    periodFrom: "",
    periodTo: "",
    tdsPaidAmount: "",
    paymentDate: "",
    note: "",
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await createPartnerTdsPayment({
        partnerId,
        ...form,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("TDS payment recorded.");
      setForm((prev) => ({ ...prev, challanNo: "", periodFrom: "", periodTo: "", tdsPaidAmount: "", paymentDate: "", note: "" }));
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Record TDS payment</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-3" onSubmit={submit}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>FY</Label>
              <Input value={form.fy} onChange={(e) => setForm((f) => ({ ...f, fy: e.target.value }))} required />
            </div>
            <div>
              <Label>Section</Label>
              <Input value={form.section} onChange={(e) => setForm((f) => ({ ...f, section: e.target.value }))} required />
            </div>
            <div>
              <Label>Challan no (optional)</Label>
              <Input value={form.challanNo} onChange={(e) => setForm((f) => ({ ...f, challanNo: e.target.value }))} />
            </div>
            <div>
              <Label>Paid amount</Label>
              <Input inputMode="decimal" value={form.tdsPaidAmount} onChange={(e) => setForm((f) => ({ ...f, tdsPaidAmount: e.target.value }))} required />
            </div>
            <div>
              <Label>Period from (optional)</Label>
              <Input type="date" value={form.periodFrom} onChange={(e) => setForm((f) => ({ ...f, periodFrom: e.target.value }))} />
            </div>
            <div>
              <Label>Period to (optional)</Label>
              <Input type="date" value={form.periodTo} onChange={(e) => setForm((f) => ({ ...f, periodTo: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <Label>Payment date</Label>
              <Input type="date" value={form.paymentDate} onChange={(e) => setForm((f) => ({ ...f, paymentDate: e.target.value }))} required />
            </div>
          </div>
          <div>
            <Label>Note</Label>
            <Textarea rows={2} value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
          </div>
          <Button type="submit" disabled={pending}>{pending ? "Saving..." : "Save TDS payment"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function ProjectProfitAllocationCard({
  fy,
  projects,
}: {
  fy: string;
  projects: ProjectOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    projectId: "",
    fy,
    profitBeforePartner: "",
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.projectId) {
      toast.error("Select a project.");
      return;
    }
    startTransition(async () => {
      const res = await upsertProjectProfitAllocation(form);
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("Project allocation updated.");
      setForm((prev) => ({ ...prev, profitBeforePartner: "" }));
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Project profit allocation</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-3" onSubmit={submit}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Project</Label>
              <Select value={form.projectId || "__none"} onValueChange={(value) => setForm((f) => ({ ...f, projectId: value === "__none" ? "" : value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Select project</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>FY</Label>
              <Input value={form.fy} onChange={(e) => setForm((f) => ({ ...f, fy: e.target.value }))} required />
            </div>
            <div>
              <Label>Profit before partner</Label>
              <Input inputMode="decimal" value={form.profitBeforePartner} onChange={(e) => setForm((f) => ({ ...f, profitBeforePartner: e.target.value }))} required />
            </div>
          </div>
          <Button type="submit" disabled={pending}>{pending ? "Saving..." : "Save allocation"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}
