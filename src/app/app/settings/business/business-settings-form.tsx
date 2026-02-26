"use client";

import { useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { uploadBillToBlob } from "@/lib/blob-upload";

import { upsertTenantProfile } from "./actions";

type Profile = {
  legalName: string;
  tradeName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  gstin: string | null;
  pan: string | null;
  bankName: string | null;
  bankAccountNo: string | null;
  bankIfsc: string | null;
  upiId: string | null;
  logoUrl: string | null;
};

export function BusinessSettingsForm({
  tenantId,
  profile,
}: {
  tenantId: number;
  profile: Profile | null;
}) {
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string>("");
  const [logoPreview, setLogoPreview] = useState(profile?.logoUrl ?? "");

  const initial = useMemo(
    () => ({
      legalName: profile?.legalName ?? "",
      tradeName: profile?.tradeName ?? "",
      phone: profile?.phone ?? "",
      email: profile?.email ?? "",
      address: profile?.address ?? "",
      gstin: profile?.gstin ?? "",
      pan: profile?.pan ?? "",
      bankName: profile?.bankName ?? "",
      bankAccountNo: profile?.bankAccountNo ?? "",
      bankIfsc: profile?.bankIfsc ?? "",
      upiId: profile?.upiId ?? "",
    }),
    [profile],
  );

  return (
    <form
      action={async (fd) => {
        setErr("");
        startTransition(async () => {
          try {
            const file = fd.get("logo");
            if (file instanceof File && file.size > 0) {
              const blob = await uploadBillToBlob({
                tenantId,
                entityPath: "tenant-profile/logo",
                file,
              });

              fd.delete("logo");
              fd.set("logoUrl", blob.url);
              fd.set("logoName", file.name);
              fd.set("logoMimeType", file.type || "application/octet-stream");
              fd.set("logoSize", String(file.size));
              setLogoPreview(blob.url);
            }

            await upsertTenantProfile(fd);
          } catch (e) {
            setErr(e instanceof Error ? e.message : "Failed to save business settings.");
          }
        });
      }}
      className="space-y-6"
    >
      <Card>
        <CardHeader>
          <CardTitle>Company</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="legalName">Legal name</Label>
              <Input id="legalName" name="legalName" defaultValue={initial.legalName} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tradeName">Trade name (optional)</Label>
              <Input id="tradeName" name="tradeName" defaultValue={initial.tradeName} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone (optional)</Label>
              <Input id="phone" name="phone" defaultValue={initial.phone} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email (optional)</Label>
              <Input id="email" name="email" type="email" defaultValue={initial.email} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address (optional)</Label>
            <Textarea id="address" name="address" rows={3} defaultValue={initial.address} />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="gstin">GSTIN (optional)</Label>
              <Input id="gstin" name="gstin" defaultValue={initial.gstin} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pan">PAN (optional)</Label>
              <Input id="pan" name="pan" defaultValue={initial.pan} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="logo">Company logo (optional)</Label>
              <Input id="logo" name="logo" type="file" accept="image/*" />
              <div className="text-xs text-muted-foreground">Uploads go directly to Vercel Blob.</div>
            </div>
            <div className="space-y-2">
              <Label>Preview</Label>
              <div className="flex min-h-24 items-center justify-center rounded-md border bg-background p-3">
                {logoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoPreview} alt="Company logo" className="max-h-20 max-w-full object-contain" />
                ) : (
                  <div className="text-sm text-muted-foreground">No logo</div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bank (optional)</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="bankName">Bank name</Label>
            <Input id="bankName" name="bankName" defaultValue={initial.bankName} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bankAccountNo">Account number</Label>
            <Input id="bankAccountNo" name="bankAccountNo" defaultValue={initial.bankAccountNo} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bankIfsc">IFSC</Label>
            <Input id="bankIfsc" name="bankIfsc" defaultValue={initial.bankIfsc} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="upiId">UPI ID</Label>
            <Input id="upiId" name="upiId" defaultValue={initial.upiId} />
          </div>
        </CardContent>
      </Card>

      {err ? <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm">{err}</div> : null}

      <div className="flex items-center justify-end gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

