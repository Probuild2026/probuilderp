"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { vendorCreateSchema, vendorMergeSchema, vendorUpdateSchema, type VendorCreateInput, type VendorMergeInput, type VendorUpdateInput } from "@/lib/validators/vendor";

import { createVendor, mergeVendors, updateVendor } from "./actions";

export function AddVendorDialog() {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const form = useForm<VendorCreateInput>({
    resolver: zodResolver(vendorCreateSchema) as any,
    defaultValues: {
      name: "",
      trade: "",
      gstin: "",
      pan: "",
      phone: "",
      email: "",
      address: "",
      isSubcontractor: false,
      legalType: "OTHER",
      active: true,
      tdsSection: "194C",
      tdsThresholdSingle: 30000,
      tdsThresholdAnnual: 100000,
      isTransporter: false,
    },
  });

  const isSubcontractor = form.watch("isSubcontractor");
  const isTransporter = form.watch("isTransporter");

  function onSubmit(values: VendorCreateInput) {
    startTransition(async () => {
      try {
        await createVendor(values);
        toast.success("Vendor created.");
        form.reset();
        setOpen(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to create vendor.");
        console.error(e);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Add Vendor</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Vendor</DialogTitle>
          <DialogDescription>Create a vendor record.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Vendor name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="trade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Trade</FormLabel>
                    <FormControl>
                      <Input placeholder="steel, cement..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="gstin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>GSTIN</FormLabel>
                    <FormControl>
                      <Input placeholder="GSTIN" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="pan"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>PAN</FormLabel>
                    <FormControl>
                      <Input placeholder="PAN" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="Phone" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="Email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Input placeholder="Address" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="isSubcontractor"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-3 rounded-md border p-3">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(!!v)} />
                    </FormControl>
                    <div className="space-y-0.5">
                      <FormLabel className="leading-none">Subcontractor</FormLabel>
                      <div className="text-xs text-muted-foreground">Enable TDS defaults (194C) for payments.</div>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="legalType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Legal type</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select legal type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="INDIVIDUAL">Individual</SelectItem>
                        <SelectItem value="HUF">HUF</SelectItem>
                        <SelectItem value="FIRM">Firm</SelectItem>
                        <SelectItem value="COMPANY">Company</SelectItem>
                        <SelectItem value="OTHER">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {isSubcontractor ? (
              <div className="space-y-4 rounded-md border p-3">
                <div className="text-sm font-medium">TDS settings (194C)</div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="tdsOverrideRate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Override rate % (optional)</FormLabel>
                        <FormControl>
                          <Input inputMode="decimal" placeholder="e.g. 1 or 2" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div />
                  <FormField
                    control={form.control}
                    name="tdsThresholdSingle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Single bill threshold</FormLabel>
                        <FormControl>
                          <Input inputMode="decimal" placeholder="30000" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="tdsThresholdAnnual"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Annual threshold</FormLabel>
                        <FormControl>
                          <Input inputMode="decimal" placeholder="100000" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="isTransporter"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-3">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(!!v)} />
                      </FormControl>
                      <FormLabel className="leading-none">Transporter</FormLabel>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {isTransporter ? (
                  <FormField
                    control={form.control}
                    name="transporterVehicleCount"
                    render={({ field }) => (
                      <FormItem className="max-w-xs">
                        <FormLabel>Vehicle count (for exemption)</FormLabel>
                        <FormControl>
                          <Input inputMode="numeric" placeholder="e.g. 1" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : null}
              </div>
            ) : null}
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export function EditVendorDialog({
  vendor,
}: {
  vendor: {
    id: string;
    name: string;
    trade: string | null;
    gstin: string | null;
    pan: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    isSubcontractor: boolean;
    legalType: "INDIVIDUAL" | "HUF" | "FIRM" | "COMPANY" | "OTHER";
    active: boolean;
    tdsSection: string;
    tdsOverrideRate: number | null;
    tdsThresholdSingle: number;
    tdsThresholdAnnual: number;
    isTransporter: boolean;
    transporterVehicleCount: number | null;
  };
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const form = useForm<VendorUpdateInput>({
    resolver: zodResolver(vendorUpdateSchema) as any,
    defaultValues: {
      id: vendor.id,
      name: vendor.name ?? "",
      trade: vendor.trade ?? "",
      gstin: vendor.gstin ?? "",
      pan: vendor.pan ?? "",
      phone: vendor.phone ?? "",
      email: vendor.email ?? "",
      address: vendor.address ?? "",
      isSubcontractor: vendor.isSubcontractor ?? false,
      legalType: vendor.legalType ?? "OTHER",
      active: vendor.active ?? true,
      tdsSection: vendor.tdsSection ?? "194C",
      tdsOverrideRate: vendor.tdsOverrideRate ?? undefined,
      tdsThresholdSingle: vendor.tdsThresholdSingle ?? 30000,
      tdsThresholdAnnual: vendor.tdsThresholdAnnual ?? 100000,
      isTransporter: vendor.isTransporter ?? false,
      transporterVehicleCount: vendor.transporterVehicleCount ?? undefined,
    },
  });

  const isSubcontractor = form.watch("isSubcontractor");
  const isTransporter = form.watch("isTransporter");

  function onSubmit(values: VendorUpdateInput) {
    startTransition(async () => {
      try {
        await updateVendor(values);
        toast.success("Vendor updated.");
        setOpen(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to update vendor.");
        console.error(e);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Vendor</DialogTitle>
          <DialogDescription>Update vendor details and TDS defaults.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Vendor name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="trade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Trade</FormLabel>
                    <FormControl>
                      <Input placeholder="steel, cement..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="gstin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>GSTIN</FormLabel>
                    <FormControl>
                      <Input placeholder="GSTIN" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="pan"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>PAN</FormLabel>
                    <FormControl>
                      <Input placeholder="PAN" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="Phone" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="Email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Input placeholder="Address" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="isSubcontractor"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-3 rounded-md border p-3">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(!!v)} />
                    </FormControl>
                    <div className="space-y-0.5">
                      <FormLabel className="leading-none">Subcontractor</FormLabel>
                      <div className="text-xs text-muted-foreground">Enable TDS defaults (194C) for payments.</div>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="legalType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Legal type</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select legal type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="INDIVIDUAL">Individual</SelectItem>
                        <SelectItem value="HUF">HUF</SelectItem>
                        <SelectItem value="FIRM">Firm</SelectItem>
                        <SelectItem value="COMPANY">Company</SelectItem>
                        <SelectItem value="OTHER">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {isSubcontractor ? (
              <div className="space-y-4 rounded-md border p-3">
                <div className="text-sm font-medium">TDS settings (194C)</div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="tdsOverrideRate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Override rate % (optional)</FormLabel>
                        <FormControl>
                          <Input inputMode="decimal" placeholder="e.g. 1 or 2" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div />
                  <FormField
                    control={form.control}
                    name="tdsThresholdSingle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Single bill threshold</FormLabel>
                        <FormControl>
                          <Input inputMode="decimal" placeholder="30000" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="tdsThresholdAnnual"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Annual threshold</FormLabel>
                        <FormControl>
                          <Input inputMode="decimal" placeholder="100000" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="isTransporter"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-3">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(!!v)} />
                      </FormControl>
                      <FormLabel className="leading-none">Transporter</FormLabel>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {isTransporter ? (
                  <FormField
                    control={form.control}
                    name="transporterVehicleCount"
                    render={({ field }) => (
                      <FormItem className="max-w-xs">
                        <FormLabel>Vehicle count (for exemption)</FormLabel>
                        <FormControl>
                          <Input inputMode="numeric" placeholder="e.g. 1" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : null}
              </div>
            ) : null}

            <FormField
              control={form.control}
              name="active"
              render={({ field }) => (
                <FormItem className="flex items-center gap-3">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(!!v)} />
                  </FormControl>
                  <FormLabel className="leading-none">Active</FormLabel>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export function MergeVendorsDialog({
  vendors,
  defaultFromVendorId,
}: {
  vendors: Array<{ id: string; name: string }>;
  defaultFromVendorId?: string;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const form = useForm<VendorMergeInput>({
    resolver: zodResolver(vendorMergeSchema) as any,
    defaultValues: {
      fromVendorId: defaultFromVendorId ?? "",
      toVendorId: "",
    },
  });

  function onSubmit(values: VendorMergeInput) {
    startTransition(async () => {
      try {
        await mergeVendors(values);
        toast.success("Vendors merged.");
        form.reset({ fromVendorId: "", toVendorId: "" });
        setOpen(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to merge vendors.");
        console.error(e);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary">Merge vendors</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Merge vendors</DialogTitle>
          <DialogDescription>
            Map one vendor into another. All bills/payments/transactions will be moved, then the source vendor is deleted.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="fromVendorId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>From (source)</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a vendor" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {vendors.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="toVendorId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>To (target)</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a vendor" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {vendors
                        .filter((v) => v.id !== form.getValues("fromVendorId"))
                        .map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={pending}>
              {pending ? "Merging…" : "Merge"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
