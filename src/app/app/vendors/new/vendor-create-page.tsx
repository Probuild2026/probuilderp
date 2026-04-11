"use client";

import { useRouter } from "next/navigation";

import { VendorDialog } from "../vendor-dialog";

export function VendorCreatePage() {
  const router = useRouter();

  return (
    <VendorDialog
      defaultOpen
      hideTrigger
      onOpenChange={(open) => {
        if (!open) router.replace("/app/vendors");
      }}
    />
  );
}
